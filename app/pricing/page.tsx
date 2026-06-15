import type { Metadata } from 'next';

import { redirect } from 'next/navigation';



export const metadata: Metadata = {

  title: 'Pricing',

  description:

    'CyberShield plans from free scans to Pro, Growth, and Agency monitoring. Compare features and upgrade anytime.',

  openGraph: {

    title: 'CyberShield Pricing',

    description: 'Affordable security monitoring for every team size.',

    type: 'website',

  },

};



export const revalidate = 3600;



export default function PricingPage() {

  redirect('/#pricing');

}

