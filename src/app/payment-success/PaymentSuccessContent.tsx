'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [orderMetadata, setOrderMetadata] = useState<any>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the payment session
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          const data = await response.json();
          setPaymentVerified(true);
          setOrderMetadata(data.metadata);
          // Trigger lead delivery
          await fetch('/api/deliver-leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId }),
          });
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId]);

  const isExclusive = orderMetadata?.leadType === 'exclusive';
  const isGuest = orderMetadata?.isGuest === 'true';

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center"
        >
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Betaling verifiëren...</h2>
          <p className="text-gray-600">Even geduld, we controleren uw betaling.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center"
      >
        {paymentVerified ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Betaling succesvol! 🎉
            </h1>

            <p className="text-gray-600 mb-6">
              {isExclusive 
                ? "Uw bestelling is bevestigd! We starten binnen 24 uur exclusieve campagnes voor u."
                : "Uw bestelling is bevestigd! U ontvangt binnen 24 uur het Excel bestand per email."
              }
            </p>

            <div className="bg-green-50 rounded-2xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-green-800 mb-2">Wat gebeurt er nu?</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✅ Betaling bevestigd</li>
                <li>📧 Bevestigingsmail verzonden</li>
                {isExclusive ? (
                  <>
                    <li>🚀 We starten binnen 24u campagnes speciaal voor u</li>
                    <li>⚡ Leads verschijnen real-time in uw persoonlijke portal</li>
                    <li>📊 We maken een Google Spreadsheet speciaal voor u aan</li>
                    {isGuest && <li>🔐 U ontvangt een link om een account aan te maken (optioneel)</li>}
                  </>
                ) : (
                  <>
                    <li>📦 Excel bestand binnen 24 uur op uw email</li>
                    <li>✅ Direct bruikbaar, geen portal nodig</li>
                    {isGuest && <li>🔐 U kunt later een account aanmaken als u dat wilt</li>}
                  </>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <Link 
                href="/"
                className="block w-full bg-gradient-to-r from-brand-purple to-brand-pink text-white font-semibold py-3 rounded-2xl hover:shadow-lg transition-all duration-300"
              >
                🏠 Terug naar homepage
              </Link>
              
              <Link 
                href="/admin/login"
                className="block w-full border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all duration-300"
              >
                📊 Bekijk uw dashboard
              </Link>
              
              <a 
                href="tel:+31850477067"
                className="block w-full border-2 border-green-200 text-green-700 font-semibold py-3 rounded-2xl hover:bg-green-50 transition-all duration-300 text-center"
              >
                📞 Direct contact: 085-0477067
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Vragen? Neem contact op via{' '}
                <a href="mailto:info@warmeleads.eu" className="text-brand-purple hover:underline">
                  info@warmeleads.eu
                </a>
                {' '}of{' '}
                <a href="tel:+31850477067" className="text-brand-purple hover:underline">
                  085-0477067
                </a>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Betaling kon niet worden geverifieerd
            </h1>

            <p className="text-gray-600 mb-6">
              We konden uw betaling niet verifiëren. Neem contact met ons op voor hulp.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => router.back()}
                className="block w-full bg-gradient-to-r from-brand-purple to-brand-pink text-white font-semibold py-3 rounded-2xl hover:shadow-lg transition-all duration-300"
              >
                Probeer opnieuw
              </button>
              
              <Link 
                href="/"
                className="block w-full border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all duration-300"
              >
                Terug naar homepage
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
