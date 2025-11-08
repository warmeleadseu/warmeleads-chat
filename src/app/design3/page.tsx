'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  StarIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  CogIcon,
  BellIcon,
  CursorArrowRaysIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';

export default function Design3Page() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: ClockIcon,
      title: "Bliksem Snel",
      subtitle: "15 minuten levertijd",
      description: "Verse leads worden direct na interesse gegenereerd en binnen 15 minuten in je systeem geleverd.",
      stats: "Gemiddeld 15 minuten",
      color: "from-blue-500 to-blue-600",
      demo: "Nieuwe lead van Jan (Amsterdam) - Zonnepanelen interesse - €4.500 budget"
    },
    {
      icon: UserGroupIcon,
      title: "100% Exclusief",
      subtitle: "Alleen jij hebt toegang",
      description: "Elke lead is uniek voor jou. Niemand anders krijgt dezelfde prospect toegewezen.",
      stats: "0% overlap",
      color: "from-green-500 to-green-600",
      demo: "Lead Maria (Rotterdam) - Thuisbatterij - €6.200 budget - Alleen voor jou"
    },
    {
      icon: ChartBarIcon,
      title: "Hoog Converterend",
      subtitle: "40% conversie naar offerte",
      description: "Onze leads zijn van hoge kwaliteit met bewezen interesse en budget.",
      stats: "40% conversie",
      color: "from-purple-500 to-purple-600",
      demo: "Lead Peter (Utrecht) - Warmtepomp - €9.800 budget - Direct contact opgenomen"
    },
    {
      icon: ShieldCheckIcon,
      title: "Betrouwbaar",
      subtitle: "99.9% uptime",
      description: "Professionele infrastructuur met realtime monitoring en backup systemen.",
      stats: "99.9% uptime",
      color: "from-indigo-500 to-indigo-600",
      demo: "Systeem actief - Laatste sync: 2 minuten geleden"
    }
  ];

  const workflowSteps = [
    {
      step: 1,
      title: "Prospect toont interesse",
      description: "Iemand vult een formulier in of neemt contact op",
      icon: CursorArrowRaysIcon
    },
    {
      step: 2,
      title: "Direct kwalificatie",
      description: "Onze AI checkt budget, locatie en urgentie",
      icon: SparklesIcon
    },
    {
      step: 3,
      title: "Exclusieve toewijzing",
      description: "Lead wordt uniek toegewezen aan één installateur",
      icon: UserGroupIcon
    },
    {
      step: 4,
      title: "Realtime notificatie",
      description: "Je krijgt direct een push notificatie en email",
      icon: BellIcon
    },
    {
      step: 5,
      title: "CRM synchronisatie",
      description: "Lead verschijnt automatisch in je systeem",
      icon: CogIcon
    },
    {
      step: 6,
      title: "Direct contact",
      description: "Start binnen 15 minuten met je nieuwe klant",
      icon: BoltIcon
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <h1>Design 3 - Interactive Features</h1>
    </div>
  );
}