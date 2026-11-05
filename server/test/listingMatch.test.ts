import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  businessKey, dedupeBusinesses, findExisting, indexExisting, normalizeName, normalizeWebsite, parseSearchedCity, placeInCity, splitGeneratable,
  type AddressPart,
} from '../src/listingMatch';

// Address components as Google Places returns them.
const part = (longText: string, shortText: string, ...types: string[]): AddressPart => ({ longText, shortText, types: [...types, 'political'] });
const city = (name: string, state: [string, string], country: [string, string] = ['United States', 'US']): AddressPart[] => [
  part(name, name, 'locality'), part(state[0], state[1], 'administrative_area_level_1'), part(country[0], country[1], 'country'),
];
const FL: [string, string] = ['Florida', 'FL'];
const inCity = (components: AddressPart[] | undefined, searched: string) => placeInCity(components, parseSearchedCity(searched));

// ─── The searched city ─────────────────────────────────────────────────────────

test("Marcus's case: a search for Miami Beach keeps Miami Beach and drops Miami", () => {
  const miamiBeach = city('Miami Beach', FL);
  const miami = city('Miami', FL);
  assert.equal(inCity(miamiBeach, 'Miami Beach, Florida'), true);
  assert.equal(inCity(miami, 'Miami Beach, Florida'), false);
});

test('however the admin writes the same city, the same places match', () => {
  const miamiBeach = city('Miami Beach', FL);
  const miami = city('Miami', FL);
  for (const typed of ['Miami Beach, Florida', 'Miami Beach, FL', 'miami beach, florida', '  Miami   Beach , Florida ', 'Miami Beach', 'MIAMI BEACH, FL']) {
    assert.equal(inCity(miamiBeach, typed), true, typed);
    assert.equal(inCity(miami, typed), false, typed);
  }
});

test('the city must match exactly, not as a prefix or a suburb', () => {
  assert.equal(inCity(city('Miami Beach', FL), 'Miami, Florida'), false);
  assert.equal(inCity(city('Miami Gardens', FL), 'Miami, Florida'), false);
  assert.equal(inCity(city('Miami', FL), 'Miami, Florida'), true);
  // The same when no state is typed at all.
  for (const typed of ['Miami', 'miami', 'Miami FL', 'Miami Florida']) {
    for (const other of ['Miami Beach', 'Miami Gardens', 'Miami Lakes', 'North Miami', 'South Miami']) {
      assert.equal(inCity(city(other, FL), typed), false, `${other} for "${typed}"`);
    }
    assert.equal(inCity(city('Miami', FL), typed), true, `Miami for "${typed}"`);
  }
  assert.equal(inCity(city('Miami Beach Gardens', FL), 'Miami Beach'), false);
});

test('a city name shared by two states is told apart by the state', () => {
  const portlandOR = city('Portland', ['Oregon', 'OR']);
  const portlandME = city('Portland', ['Maine', 'ME']);
  assert.equal(inCity(portlandOR, 'Portland, Oregon'), true);
  assert.equal(inCity(portlandME, 'Portland, Oregon'), false);
  assert.equal(inCity(portlandME, 'Portland, ME'), true);
  assert.equal(inCity(city('Kansas City', ['Kansas', 'KS']), 'Kansas City, Missouri'), false);
  // With no state typed, either is accepted: the admin has not said which.
  assert.equal(inCity(portlandME, 'Portland'), true);
});

// ─── Address shapes exactly as Google Places returns them ──────────────────────
// Checked against live results (the businesses themselves are made up): Manhattan
// has the city "New York", but Brooklyn, Queens, the Bronx and Staten Island have
// only their borough name and no city at all; London has a postal town, not a
// locality; Toronto has a locality and a district; some parts carry no type.
const NY = part('New York', 'NY', 'administrative_area_level_1');
const US = part('United States', 'US', 'country');
const manhattan: AddressPart[] = [
  part('Midtown', 'Midtown', 'neighborhood'), part('Manhattan', 'Manhattan', 'sublocality_level_1', 'sublocality'),
  part('New York', 'New York', 'locality'), part('New York County', 'New York County', 'administrative_area_level_2'), NY, US,
];
const borough = (neighborhood: string, name: string, county: string): AddressPart[] => [
  part(neighborhood, neighborhood, 'neighborhood'), part(name, name, 'sublocality_level_1', 'sublocality'),
  part(county, county, 'administrative_area_level_2'), NY, US,
];
const brooklyn = borough('East Flatbush', 'Brooklyn', 'Kings County');
const queens = borough('Astoria', 'Queens', 'Queens County');
const bronx = borough('Fordham', 'The Bronx', 'Bronx County');
const statenIsland = borough('Port Richmond', 'Staten Island', 'Richmond County');
const allFive = { manhattan, brooklyn, queens, bronx, statenIsland };

test('New York City is its five boroughs, and nothing around it', () => {
  const yonkers = city('Yonkers', ['New York', 'NY']);
  const newark = city('Newark', ['New Jersey', 'NJ']);
  const brooklynOhio = city('Brooklyn', ['Ohio', 'OH']);
  for (const typed of ['New York, New York', 'New York', 'New York City, New York', 'New York, NY', 'New York NY', 'New York City', 'NYC', 'nyc, ny']) {
    for (const [name, place] of Object.entries(allFive)) assert.equal(inCity(place, typed), true, `${name} for "${typed}"`);
    assert.equal(inCity(yonkers, typed), false, `Yonkers for "${typed}"`);
    assert.equal(inCity(newark, typed), false, `Newark for "${typed}"`);
    assert.equal(inCity(brooklynOhio, typed), false, `Brooklyn, Ohio for "${typed}"`);
  }
});

test('a borough search finds only that borough', () => {
  const only = (typed: string, expected: string) => {
    for (const [name, place] of Object.entries(allFive)) assert.equal(inCity(place, typed), name === expected, `${name} for "${typed}"`);
  };
  only('Brooklyn, New York', 'brooklyn');
  only('Manhattan, New York', 'manhattan');
  only('Queens, New York', 'queens');
  only('Staten Island, New York', 'statenIsland');
  only('The Bronx, New York', 'bronx');
  only('Bronx, New York', 'bronx');
  only('Brooklyn NY', 'brooklyn');
});

test('a Brooklyn in another state is a different place, unless no state was typed', () => {
  const brooklynOhio = city('Brooklyn', ['Ohio', 'OH']);
  assert.equal(inCity(brooklynOhio, 'Brooklyn, Ohio'), true);
  assert.equal(inCity(brooklynOhio, 'Brooklyn, New York'), false);
  assert.equal(inCity(brooklyn, 'Brooklyn, Ohio'), false);
  assert.equal(inCity(brooklynOhio, 'Brooklyn'), true, 'the admin has not said which Brooklyn');
  assert.equal(inCity(brooklyn, 'Brooklyn'), true);
});

test('a city that shares its state\'s name, or has "City" in it, is matched correctly', () => {
  assert.equal(inCity(city('Kansas City', ['Kansas', 'KS']), 'Kansas City, Kansas'), true);
  assert.equal(inCity(city('Kansas City', ['Missouri', 'MO']), 'Kansas City, Kansas'), false, 'same name, other state');
  assert.equal(inCity(city('Kansas City', ['Missouri', 'MO']), 'Kansas City, Missouri'), true);
  assert.equal(inCity(city('Oklahoma City', ['Oklahoma', 'OK']), 'Oklahoma City, Oklahoma'), true);
  assert.equal(inCity(city('Edmond', ['Oklahoma', 'OK']), 'Oklahoma City, Oklahoma'), false, 'a suburb is not the city');
});

test('spelling differences in the name do not hide a business', () => {
  assert.equal(inCity(city('St. Petersburg', FL), 'Saint Petersburg, Florida'), true);
  assert.equal(inCity(city('Saint Petersburg', FL), 'St. Petersburg, Florida'), true);
  assert.equal(inCity(city('San José', ['California', 'CA']), 'San Jose, California'), true);
  assert.equal(inCity(city('Fort Lauderdale', FL), 'Ft. Lauderdale, FL'), true);
});

test('a label with a neighbourhood, or a country, is understood', () => {
  const miamiBeach = city('Miami Beach', FL);
  assert.equal(inCity(miamiBeach, 'South Beach, Miami Beach, Florida'), true, 'the containing city counts');
  assert.equal(inCity(city('Miami', FL), 'South Beach, Miami Beach, Florida'), false);

  const paris = city('Paris', ['Île-de-France', 'IDF'], ['France', 'FR']);
  assert.equal(inCity(paris, 'Paris, Île-de-France, France'), true);
  assert.equal(inCity(paris, 'Paris, France'), true, 'a country alone is a valid region');
  assert.equal(inCity(city('Paris', ['Texas', 'TX']), 'Paris, Île-de-France, France'), false);
});

test('a place whose address names no city is kept rather than hidden', () => {
  assert.equal(inCity([part('Florida', 'FL', 'administrative_area_level_1')], 'Miami Beach, Florida'), true);
  assert.equal(inCity(undefined, 'Miami Beach, Florida'), true);
  assert.equal(inCity([], 'Miami Beach, Florida'), true);
});

test('with nothing to compare against, nothing is hidden', () => {
  assert.equal(inCity(city('Miami', FL), ''), true);
  assert.equal(inCity(city('Miami', FL), ' , '), true);
});

test('a place missing its state is judged on the city alone', () => {
  const noState: AddressPart[] = [part('Miami Beach', 'Miami Beach', 'locality')];
  assert.equal(inCity(noState, 'Miami Beach, Florida'), true);
  assert.equal(inCity(noState, 'Miami, Florida'), false);
});

// The City box accepts free text, so the admin may type it without commas, or add
// a ZIP code or a country.
test('a city typed without commas, with a ZIP code, or with a country, still matches', () => {
  const miamiBeach = city('Miami Beach', FL);
  const miami = city('Miami', FL);
  const typedForms = [
    'Miami Beach FL', 'Miami Beach Florida', 'miami beach fl', 'Miami Beach Florida USA', 'Miami Beach FL US',
    'Miami Beach, FL 33139', 'Miami Beach FL 33139', 'Miami Beach, Florida 33139-1234', 'Miami Beach, FL, USA',
    'Miami Beach, United States', 'Miami Beach, USA', 'Miami Beach USA', 'Miami Beach, Florida, United States',
  ];
  for (const typed of typedForms) {
    assert.equal(inCity(miamiBeach, typed), true, typed);
    assert.equal(inCity(miami, typed), false, `Miami for "${typed}"`);
  }
  assert.equal(inCity(city('Miami Gardens', FL), 'Miami Beach FL'), false);
  assert.equal(inCity(miami, 'Miami FL'), true);
  assert.equal(inCity(city('Miami Beach', FL), 'Miami FL'), false);
});

test('typed without commas, the state still tells two cities of one name apart', () => {
  const portlandOR = city('Portland', ['Oregon', 'OR']);
  const portlandME = city('Portland', ['Maine', 'ME']);
  assert.equal(inCity(portlandME, 'Portland ME'), true);
  assert.equal(inCity(portlandOR, 'Portland ME'), false);
  assert.equal(inCity(portlandOR, 'Portland Oregon'), true);
  assert.equal(inCity(portlandME, 'Portland Oregon'), false);
  assert.equal(inCity(city('St. Petersburg', FL), 'St Petersburg FL'), true);
  assert.equal(inCity(city('Billings', ['Montana', 'MT']), 'Billings MT'), true);
  assert.equal(inCity(city('Billings', ['Montana', 'MT']), 'Billings, Montana'), true);
});

test('real shapes: London (a postal town), Toronto, Washington DC and Honolulu', () => {
  const london: AddressPart[] = [
    part('Lower Clapton', 'Lower Clapton', 'neighborhood'), part('London', 'London', 'postal_town'),
    part('Greater London', 'Greater London', 'administrative_area_level_2'), part('England', 'England', 'administrative_area_level_1'),
    part('United Kingdom', 'GB', 'country'),
  ];
  const londonOntario = city('London', ['Ontario', 'ON'], ['Canada', 'CA']);
  for (const typed of ['London, England, United Kingdom', 'London', 'London, UK', 'London UK', 'London England', 'London, England']) {
    assert.equal(inCity(london, typed), true, typed);
  }
  assert.equal(inCity(londonOntario, 'London, England, United Kingdom'), false);
  assert.equal(inCity(londonOntario, 'London, Ontario, Canada'), true);
  assert.equal(inCity(london, 'London, Ontario, Canada'), false);

  const toronto: AddressPart[] = [
    part('Old Toronto', 'Old Toronto', 'sublocality_level_1', 'sublocality'), part('Toronto', 'Toronto', 'locality'),
    part('Toronto', 'Toronto', 'administrative_area_level_3'), part('Toronto', 'Toronto', 'administrative_area_level_2'),
    part('Ontario', 'ON', 'administrative_area_level_1'), part('Canada', 'CA', 'country'),
  ];
  const mississauga = city('Mississauga', ['Ontario', 'ON'], ['Canada', 'CA']);
  assert.equal(inCity(toronto, 'Toronto, Ontario, Canada'), true);
  assert.equal(inCity(toronto, 'Old Toronto, Ontario'), true);
  assert.equal(inCity(mississauga, 'Toronto, Ontario, Canada'), false);

  const dc = city('Washington', ['District of Columbia', 'DC']);
  const silverSpring = city('Silver Spring', ['Maryland', 'MD']);
  assert.equal(inCity(dc, 'Washington, District of Columbia'), true);
  assert.equal(inCity(dc, 'Washington DC'), true);
  assert.equal(inCity(silverSpring, 'Washington, District of Columbia'), false);

  const honolulu = city('Honolulu', ['Hawaii', 'HI']);
  assert.equal(inCity(honolulu, 'Honolulu, Hawaii'), true);
  for (const nearby of ['Aiea', 'Kailua', 'Waipahu']) assert.equal(inCity(city(nearby, ['Hawaii', 'HI']), 'Honolulu, Hawaii'), false, nearby);
});

test('address parts with no type list, or no text, never break the match', () => {
  // Google sometimes returns a part with a name and no types (a business name inside the address).
  const odd: AddressPart[] = [
    { longText: 'City Plumbers', shortText: 'City Plumbers' },
    { types: ['locality', 'political'] },
    part('Miami Beach', 'Miami Beach', 'locality'), part('Florida', 'FL', 'administrative_area_level_1'), US,
  ];
  assert.equal(inCity(odd, 'Miami Beach, Florida'), true);
  assert.equal(inCity(odd, 'Miami, Florida'), false);
  assert.equal(inCity([{ longText: 'City Plumbers' }], 'Miami Beach, Florida'), true, 'nothing city-like: kept');
});

test('a ZIP code alone does not become a city', () => {
  assert.equal(inCity(city('Miami Beach', FL), '33139'), true, 'nothing left to compare, so nothing is hidden');
  assert.deepEqual(parseSearchedCity('Miami Beach, FL 33139'), { names: ['miami beach'], regions: ['fl'], whole: 'miami beach fl' });
});

// ─── The same business, listed twice ───────────────────────────────────────────

test('websites are compared without the parts that vary', () => {
  const same = ['https://www.fernandowongold.com/', 'http://fernandowongold.com', 'fernandowongold.com', 'HTTPS://WWW.FernandoWongOld.com/index.html?utm_source=google#top'.replace('Old', 'old'), 'https://fernandowongold.com/index.php'];
  const keys = new Set(same.map(normalizeWebsite));
  assert.equal(keys.size, 1, [...keys].join(' | '));
  assert.equal(normalizeWebsite(''), '');
  assert.notEqual(normalizeWebsite('foreverlawn.com/southbeach'), normalizeWebsite('foreverlawn.com/miami'), 'chain branches differ by page');
});

test('names are compared without punctuation, case or accents', () => {
  assert.equal(normalizeName("Fernando Wong's  Outdoor-Living, Design!"), normalizeName('fernando wongs outdoor living design'));
  assert.equal(normalizeName('Café & Co'), normalizeName('cafe and co'));
});

const biz = (name: string, website: string, reviewCount = 0, placeId = name) => ({ placeId, name, website, reviewCount });

test("Marcus's case: one business listed twice by Google appears once", () => {
  const list = [
    biz('Fernando Wong Outdoor Living Design', 'https://fernandowongold.com', 3, 'ChIJ-A'),
    biz('Chop Chop Tree', 'https://treeserviceinmiamiflorida.com', 2, 'ChIJ-B'),
    biz('Fernando Wong Outdoor Living Design', 'https://www.fernandowongold.com/', 11, 'ChIJ-C'),
  ];
  const { kept, removed } = dedupeBusinesses(list);
  assert.equal(removed, 1);
  assert.deepEqual(kept.map((b) => b.placeId), ['ChIJ-B', 'ChIJ-C'], 'the better-reviewed profile stays, order is kept');
});

test('on a tie the one Google ranked first stays', () => {
  const { kept } = dedupeBusinesses([biz('A Co', 'a.com', 5, 'first'), biz('A Co', 'a.com', 5, 'second')]);
  assert.deepEqual(kept.map((b) => b.placeId), ['first']);
});

test('different businesses are never merged', () => {
  const list = [
    biz('ForeverLawn South Beach', 'foreverlawn.com/southbeach'),
    biz('ForeverLawn Miami', 'foreverlawn.com/miami'),          // same site, other branch page and name
    biz('Acme Lawns', 'shared-host.com'),
    biz('Acme Pools', 'shared-host.com'),                       // same site, other brand
    biz('Green Co', 'green-one.com'),
    biz('Green Co', 'green-two.com'),                           // same name, different site
  ];
  assert.equal(dedupeBusinesses(list).removed, 0);
});

test('a business with no website is never treated as a duplicate of another', () => {
  assert.equal(businessKey('Acme', ''), null);
  assert.equal(dedupeBusinesses([biz('Acme', ''), biz('Acme', '')]).removed, 0);
});

// ─── Businesses that already have a post ───────────────────────────────────────

const posts = {
  '-Opost1': { placeId: 'ChIJ-A', sellerName: 'AS4Less Landscaping', website: 'https://as4less-landscaping.com', status: 'active' },
  '-Opost2': { placeId: 'ChIJ-OLD', sellerName: 'Fernando Wong Outdoor Living Design', website: 'https://fernandowongold.com', status: 'draft' },
  '-Opost3': { placeId: 'ChIJ-GONE', sellerName: 'Gone Landscaping', website: 'https://gone.com', status: 'deleted' },
  '-Opost4': null,
};

test('an existing post is found by place id, or by website and name when the id differs', () => {
  const index = indexExisting(posts);
  assert.equal(findExisting(index, { placeId: 'ChIJ-A', name: 'Renamed', website: 'x.com' })?.id, '-Opost1', 'by place id');
  const dup = findExisting(index, { placeId: 'ChIJ-NEW', name: 'Fernando Wong Outdoor Living Design', website: 'https://www.fernandowongold.com/' });
  assert.equal(dup?.id, '-Opost2', 'the same business under another Google profile');
  assert.equal(dup?.status, 'draft');
  assert.equal(findExisting(index, { placeId: 'ChIJ-NEW', name: 'Someone Else', website: 'else.com' }), null);
});

test('a deleted post no longer stands for its business', () => {
  const index = indexExisting(posts);
  assert.equal(findExisting(index, { placeId: 'ChIJ-GONE', name: 'Gone Landscaping', website: 'gone.com' }), null);
});

test('no index, no existing post', () => {
  assert.equal(findExisting(null, { placeId: 'ChIJ-A' }), null);
  assert.deepEqual([...indexExisting(null).byPlace], []);
});

test('a selection is split into what can be generated and what cannot, with the reason', () => {
  const index = indexExisting(posts);
  const selection = [
    { placeId: 'ChIJ-1', name: 'Fresh One', website: 'one.com' },
    { placeId: 'ChIJ-A', name: 'AS4Less Landscaping', website: 'as4less-landscaping.com' },        // already has a post
    { placeId: 'ChIJ-1', name: 'Fresh One', website: 'one.com' },                                    // the same place twice
    { placeId: 'ChIJ-2', name: 'Fresh One', website: 'https://www.one.com/' },                       // same business, other profile
    { placeId: 'ChIJ-3', name: 'Fresh Three', website: 'three.com' },
  ];
  const { fresh, skipped } = splitGeneratable(selection, index);
  assert.deepEqual(fresh.map((b) => b.placeId), ['ChIJ-1', 'ChIJ-3']);
  assert.deepEqual(skipped, [
    { name: 'AS4Less Landscaping', reason: 'it already has a post' },
    { name: 'Fresh One', reason: 'it is selected twice' },
    { name: 'Fresh One', reason: 'it is selected twice' },
  ]);
});

test('with the existing posts unreadable, repeats within one selection are still caught', () => {
  const { fresh, skipped } = splitGeneratable([{ placeId: 'a', name: 'X', website: 'x.com' }, { placeId: 'b', name: 'X', website: 'x.com' }], null);
  assert.equal(fresh.length, 1);
  assert.equal(skipped.length, 1);
});
