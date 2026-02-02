"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-white text-gray-900 pt-24 pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-16 mb-32">
          
          {/* Left: "Experience liftoff" */}
          <div className="md:w-1/3">
            <h3 className="text-3xl font-medium tracking-tight">
              Experience liftoff
            </h3>
          </div>

          {/* Right: Links */}
          <div className="flex gap-24">
            
            {/* Product Column */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Product
              </h4>
              <ul className="space-y-4">
                <li><Link href="#" className="font-medium hover:text-blue-600 transition-colors">Start a Call</Link></li>
                <li><Link href="#" className="font-medium hover:text-blue-600 transition-colors">Product</Link></li>
                <li><Link href="#" className="font-medium hover:text-blue-600 transition-colors">Docs</Link></li>
              </ul>
            </div>

            {/* Resources Column */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Resources
              </h4>
              <ul className="space-y-4">
                <li><Link href="#" className="font-medium hover:text-blue-600 transition-colors">Pricing</Link></li>
                <li><Link href="#" className="font-medium hover:text-blue-600 transition-colors">Use Cases</Link></li>
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom Section: Giant Text */}
        <div className="border-t border-gray-100 pt-12">
           <h1 className="text-[12vw] leading-none font-bold bg-gradient-to-br from-black to-blue-950 tracking-loose text-center md:text-left select-none bg-clip-text text-transparent">
             <span className="bg-clip-text text-transparent bg-gradient-to-br from-black to-blue-950">
               Orbicall
             </span>
           </h1>
        </div>
        
      </div>
    </footer>
  );
}
