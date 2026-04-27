import { Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  MessageCircle,
  Bell,
  ChevronDown,
  Star,
  X
} from 'lucide-react';
import { CurrentUserAvatar } from './UserAvatar';

const categories = [
  "Automotive", "Business", "Graphics & Design", "Home & Garden", 
  "Labor & Moving", "Lessons", "Legal", "Marketing", 
  "Programming & Tech", "Real Estate", "Skilled Trade"
];

const filters = [
  "Budget", "Rating", "Verified", "Remote", "Language", "Online Now"
];

const listings = [
  {
    id: 1,
    name: "Town to Town Movers",
    verified: true,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY",
    pricePrefix: "From",
    price: "$200",
    priceUnit: "per project"
  },
  {
    id: 2,
    name: "Town to Town Movers",
    verified: false,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY +5 more",
    pricePrefix: "",
    price: "$1K - $99K",
    priceUnit: "per project"
  },
  {
    id: 3,
    name: "Town to Town Movers",
    verified: true,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY +5 more",
    pricePrefix: "From",
    price: "$200",
    priceUnit: "per project"
  },
  {
    id: 4,
    name: "Town to Town Movers",
    verified: false,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "United States",
    pricePrefix: "",
    price: "$5 - $10",
    priceUnit: "per hour"
  },
  {
    id: 5,
    name: "Town to Town Movers",
    verified: false,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY +5 more",
    pricePrefix: "",
    price: "$1K - $100K",
    priceUnit: "per project"
  },
  {
    id: 6,
    name: "Town to Town Movers",
    verified: true,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY +5 more",
    pricePrefix: "From",
    price: "$100",
    priceUnit: "per project"
  },
  {
    id: 7,
    name: "Town to Town Movers",
    verified: false,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Canada",
    pricePrefix: "From",
    price: "$20",
    priceUnit: "per hour"
  },
  {
    id: 8,
    name: "Town to Town Movers",
    verified: false,
    rating: "5.0",
    reviews: "10",
    title: "I will help you move locally, or within a 40 mile radius of your home",
    location: "Staten Island, NY +5 more",
    pricePrefix: "",
    price: "$95 - $475",
    priceUnit: "per project"
  }
];

const BuyerSearchFiltered = () => {
  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Top Main Navigation */}
      <header className="w-full px-6 py-4 lg:px-12 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center flex-1">
          {/* Logo */}
          <Link to="/" className="flex items-center mr-10 shrink-0">
            <MapPin className="text-primary w-6 h-6 mr-1" />
            <span className="text-2xl font-bold tracking-tight text-white">igspace</span>
          </Link>
          
          {/* Search Bar */}
          <div className="hidden md:flex items-center bg-[#0E1422] border border-slate-700 rounded-lg overflow-hidden h-10 w-full max-w-xl">
            {/* Location Dropdown */}
            <div className="px-4 border-r border-slate-700 flex items-center shrink-0 cursor-pointer text-slate-300 text-sm h-full bg-[#1A2035]">
              All locations
              <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
            </div>
            {/* Input */}
            <input 
              type="text" 
              placeholder="Search for a service" 
              className="flex-1 bg-transparent px-4 text-sm text-white focus:outline-none placeholder-slate-500"
            />
            {/* Search Button */}
            <button className="bg-primary h-full px-4 flex items-center justify-center hover:bg-blue-600 transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        
        {/* Right Nav Icons */}
        <div className="flex items-center space-x-6 shrink-0">
          <button className="text-slate-400 hover:text-white transition-colors">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
            {/* Notification Dot */}
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 border border-[#0E1422] rounded-full"></span>
          </button>
          <Link to="/post-service" className="text-sm font-medium hover:text-primary transition-colors text-slate-300 hidden sm:block">
            Create New Post
          </Link>
          <CurrentUserAvatar size="sm" />
        </div>
      </header>

      {/* Secondary Categories Nav */}
      <nav className="w-full px-6 lg:px-12 py-3 border-b border-slate-800 overflow-x-auto no-scrollbar">
        <ul className="flex items-center space-x-8 text-sm text-slate-400 whitespace-nowrap font-medium min-w-max">
          {categories.map((category, idx) => (
            <li key={idx}>
              <button className="hover:text-white transition-colors">
                {category}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 px-6 lg:px-12 py-10">
        
        <div className="text-sm font-medium mb-4">
          <span className="text-white hover:underline cursor-pointer">All Services</span>
          <span className="text-slate-500 mx-2">/</span>
          <span className="text-slate-400">Labor & Moving</span>
        </div>
        <h1 className="text-3xl font-bold mb-8">Residential Moving</h1>
        
        {/* Filters Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 pb-6 gap-4">
          <div className="flex items-center text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
            Sort
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
          
          <div className="flex flex-wrap items-center gap-6">
            {filters.map((filter, idx) => (
              <div key={idx} className="flex items-center text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                {filter}
                <ChevronDown className="w-4 h-4 ml-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Active Filters Full-Width Bar */}
        <div className="w-full bg-[#1A2035] -mx-6 lg:-mx-12 px-6 lg:px-12 py-4 mb-8 flex items-center flex-wrap gap-4 border-t border-b border-slate-800 hidden sm:flex">
          <span className="text-slate-400 text-sm font-medium">Filters</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-300 rounded-full pl-4 pr-3 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-700/50">
              <span>Distance: 10 miles</span>
              <X className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex items-center space-x-2 bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-300 rounded-full pl-4 pr-3 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-700/50">
              <span>Budget: $100,000</span>
              <X className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex items-center space-x-2 bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-300 rounded-full pl-4 pr-3 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-700/50">
              <span className="flex items-center">Rating: 5 <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 ml-1.5" /></span>
              <X className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Grid of Listings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 mt-4">
          {listings.map((listing) => (
            <div key={listing.id} className="group cursor-pointer">
              {/* Image constraints matching exact figma visual */}
              <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 relative bg-slate-800">
                <img 
                  src="/service-card-image.png" 
                  alt="Service preview" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out" 
                />
              </div>
              
              {/* Seller Info */}
              <div className="flex items-center mb-2">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center mr-2 shrink-0 overflow-hidden">
                  <span className="text-[8px] font-bold text-red-600 tracking-tighter">TOWN</span>
                </div>
                <span className="text-sm font-medium mr-1">{listing.name}</span>
                {listing.verified && (
                  <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
                  </svg>
                )}
              </div>
              
              {/* Rating */}
              <div className="flex items-center mb-2">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 mr-1.5" />
                <span className="text-sm font-semibold">{listing.rating}</span>
                <span className="text-sm text-slate-500 ml-1">({listing.reviews})</span>
              </div>
              
              {/* Title */}
              <h3 className="font-medium text-white mb-2 leading-snug group-hover:underline">
                {listing.title}
              </h3>
              
              {/* Location */}
              <div className="flex items-center text-slate-400 text-xs mb-3">
                <MapPin className="w-3 h-3 mr-1.5 shrink-0" />
                {listing.location}
              </div>
              
              {/* Price */}
              <div className="text-sm">
                {listing.pricePrefix && <span className="text-slate-400">{listing.pricePrefix} </span>}
                <span className="font-bold text-lg">{listing.price}</span>
                <span className="text-slate-400 text-xs ml-1">{listing.priceUnit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center py-6 border-t border-slate-800 border-b border-slate-800 mb-16">
          <div className="text-slate-400 text-sm mb-4 sm:mb-0">
            Showing 1 to 20 of 53 results
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
              Next
            </button>
          </div>
        </div>

      </main>

      {/* Standard Footer */}
      <footer className="w-full py-10 flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-8 mb-8 text-sm text-slate-300">
          <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-white transition-colors">For Sellers</Link>
          <button className="hover:text-white transition-colors">For Buyers</button>
          <button className="hover:text-white transition-colors">Affiliate Program</button>
          <button className="hover:text-white transition-colors">Terms & Conditions</button>
          <button className="hover:text-white transition-colors">Privacy Policy</button>
        </div>
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Gigspace, LLC. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default BuyerSearchFiltered;
