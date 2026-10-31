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

test('New York: a borough address is found by the borough or by the city', () => {
  const brooklyn: AddressPart[] = [
    part('Brooklyn', 'Brooklyn', 'sublocality_level_1', 'sublocality'),
    part('New York', 'New York', 'locality'),
    part('New York', 'NY', 'administrative_area_level_1'),
    part('United States', 'US', 'country'),
  ];
  assert.equal(inCity(brooklyn, 'Brooklyn, New York'), true);
  assert.equal(inCity(brooklyn, 'New York, New York'), true);
  assert.equal(inCity(brooklyn, 'Queens, New York'), false);
  // The spelling the picker used to produce.
  assert.equal(inCity(brooklyn, 'New York City, New York'), true);
});

test('Staten Island, which Google gives no locality at all, is still found', () => {
  const staten: AddressPart[] = [
    part('Staten Island', 'Staten Island', 'sublocality_level_1', 'sublocality'),
    part('New York', 'NY', 'administrative_area_level_1'),
    part('United States', 'US', 'country'),
  ];
  assert.equal(inCity(staten, 'Staten Island, New York'), true);
  assert.equal(inCity(staten, 'Brooklyn, New York'), false);
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
