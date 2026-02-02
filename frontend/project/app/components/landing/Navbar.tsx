"use client";

import { Video } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="logo" width={150} height={150} />
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-gray-600 hover:text-black transition-colors font-medium"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-gray-600 hover:text-black transition-colors font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/enterprise"
              className="text-gray-600 hover:text-black transition-colors font-medium"
            >
              Enterprise
            </Link>
          </div>

          <button className="bg-gray-900 text-white px-5 py-2 rounded-full font-medium hover:bg-gray-800 transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
