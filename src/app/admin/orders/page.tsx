'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  CurrencyEuroIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  customerCompany: string | null;
  packageId: string;
  packageName: string;
  industry: string;
  leadType: 'exclusive' | 'shared';
  quantity: number;
  pricePerLead: number;
  totalAmount: number;
  vatAmount: number;
  totalAmountInclVAT: number;
  vatPercentage: number;
  currency: string;
  status: 'pending' | 'completed' | 'delivered' | 'cancelled';
  paymentMethod: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  leadsDelivered: number;
  conversions: number;
  deliveredAt: string | null;
  createdAt: string;
  paidAt: string | null;
  customer: {
    id: string;
    email: string;
    name: string;
    company: string | null;
    googleSheetId: string | null;
    googleSheetUrl: string | null;
  } | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      console.log('📦 Loading orders from admin API...');
      
      const response = await fetch('/api/admin/orders');
      
      if (!response.ok) {
        throw new Error('Failed to load orders');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Loaded ${data.orders.length} orders`);
        setOrders(data.orders);
      } else {
        console.error('❌ Failed to load orders:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.industry.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: orders.length,
    completed: orders.filter(o => o.status === 'completed').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    pending: orders.filter(o => o.status === 'pending').length,
    revenue: orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmountInclVAT, 0),
    pendingRevenue: orders
      .filter(o => o.status === 'pending')
      .reduce((sum, o) => sum + o.totalAmountInclVAT, 0),
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />;
      case 'delivered':
        return <TruckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />;
      default:
        return <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bestellingen</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {filteredOrders.length} bestellingen • {formatCurrency(stats.revenue)} totale omzet
          </p>
        </div>
        
        <button
          onClick={loadOrders}
          className="bg-brand-purple hover:bg-brand-purple/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
        >
          🔄 Ververs
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <motion.div
          className="admin-card p-4 sm:p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-brand-purple">{stats.total}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Totaal Bestellingen</div>
        </motion.div>
        
        <motion.div
          className="admin-card p-4 sm:p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{formatCurrency(stats.revenue)}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Gerealiseerde Omzet</div>
        </motion.div>
        
        <motion.div
          className="admin-card p-4 sm:p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{formatCurrency(stats.pendingRevenue)}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Pending Omzet</div>
        </motion.div>
        
        <motion.div
          className="admin-card p-4 sm:p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-brand-pink">{stats.delivered}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Afgeronde Orders</div>
        </motion.div>
      </div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 sm:gap-4"
      >
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Zoek bestellingen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
          />
        </div>
        
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
        >
          <option value="all">Alle Statussen</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </motion.div>

      {/* Orders List */}
      {isLoading ? (
        <div className="admin-card py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple mx-auto"></div>
          <p className="text-gray-500 mt-4">Bestellingen laden...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Geen bestellingen gevonden' : 'Nog geen bestellingen'}
            </h3>
            <p className="text-sm sm:text-base text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Probeer andere zoekfilters' 
                : 'Bestellingen verschijnen hier automatisch wanneer klanten leads kopen'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">Hoe krijg je bestellingen?</h4>
                <ul className="text-xs sm:text-sm text-green-700 text-left space-y-1">
                  <li>• Klanten gaan naar www.warmeleads.eu</li>
                  <li>• Ze starten de chat en kiezen leads</li>
                  <li>• Na succesvolle Stripe betaling</li>
                  <li>• Verschijnt de bestelling automatisch hier</li>
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="admin-card overflow-hidden"
        >
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bedrag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                      {order.invoiceNumber && (
                        <div className="text-xs text-gray-500">{order.invoiceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      {order.customerCompany && (
                        <div className="text-xs text-gray-500">{order.customerCompany}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{order.industry}</div>
                      <div className="text-xs text-gray-500">
                        {order.quantity} {order.leadType} leads
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.totalAmountInclVAT)}
                      </div>
                      <div className="text-xs text-gray-500">
                        incl. {formatCurrency(order.vatAmount)} BTW
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {order.invoiceUrl && (
                        <a
                          href={order.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-purple hover:text-brand-purple/80 inline-flex items-center gap-1"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Factuur
                        </a>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-gray-200">
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{order.orderNumber}</div>
                    {order.invoiceNumber && (
                      <div className="text-xs text-gray-500">{order.invoiceNumber}</div>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Klant:</span>{' '}
                    <span className="font-medium text-gray-900">{order.customerName}</span>
                  </div>
                  <div className="text-xs text-gray-500">{order.customerEmail}</div>
                  
                  <div>
                    <span className="text-gray-500">Product:</span>{' '}
                    <span className="text-gray-900">
                      {order.quantity} {order.leadType} {order.industry} leads
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Bedrag:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {formatCurrency(order.totalAmountInclVAT)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      (incl. {formatCurrency(order.vatAmount)} BTW)
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {formatDate(order.createdAt)}
                  </div>
                  
                  {order.invoiceUrl && (
                    <div className="pt-2">
                      <a
                        href={order.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-purple hover:text-brand-purple/80 inline-flex items-center gap-1 text-sm"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Download factuur
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
