'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  BellIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { getFirstAdminEmail } from '@/config/admin';

export function AdminHeader() {
  return (
    <motion.header
      className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3 lg:py-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Search - Hidden on very small screens, shown on sm and up */}
        <div className="hidden sm:flex flex-1 max-w-xs lg:max-w-lg">
          <div className="relative w-full">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Zoeken..."
              className="w-full pl-8 lg:pl-10 pr-3 lg:pr-4 py-1.5 lg:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 ml-auto">
          {/* Live Stats - Hidden on mobile */}
          <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 text-xs xl:text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-gray-600">12 Active Chats</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-brand-orange rounded-full" />
              <span className="text-gray-600">€2,340 Today</span>
            </div>
          </div>

          {/* Notifications */}
          <motion.button
            className="relative p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BellIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            <span className="absolute top-0.5 right-0.5 lg:top-1 lg:right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </motion.button>

          {/* User Menu */}
          <div className="relative group">
            <motion.button
              className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 text-gray-600 hover:text-gray-800 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <UserCircleIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 flex-shrink-0" />
              <div className="hidden lg:block text-left">
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-gray-500 truncate max-w-[120px]">{getFirstAdminEmail()}</div>
              </div>
            </motion.button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <button
                  onClick={() => {
                    localStorage.removeItem('warmeleads_admin_token');
                    localStorage.removeItem('warmeleads_admin_user');
                    window.location.href = '/admin/login';
                  }}
                  className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  🚪 Uitloggen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
