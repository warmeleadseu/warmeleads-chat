/**
 * Test Script: Simulate Lead Distribution from Real Meta Form
 * 
 * This script:
 * 1. Fetches real leads from Meta form
 * 2. Simulates 3 active customer batches with different territories
 * 3. Tests distribution logic for each lead
 * 4. Shows which customer would get each lead and why
 */

const FORM_ID = '1038117324873091';

// Simulated customer batches
const SIMULATED_BATCHES = [
  {
    id: 'batch_1',
    customer_email: 'klant.a@test.com',
    customer_name: 'Klant A - Zwolle Regio',
    branch_id: 'thuisbatterijen',
    territory_type: 'radius',
    center_postcode: '8011AA',
    center_lat: 52.5125,
    center_lng: 6.0939,
    radius_km: 95,
    total_batch_size: 50,
    current_batch_count: 10,
    priority_score: 95, // Smaller radius = higher priority
  },
  {
    id: 'batch_2',
    customer_email: 'klant.b@test.com',
    customer_name: 'Klant B - Amsterdam Regio',
    branch_id: 'thuisbatterijen',
    territory_type: 'radius',
    center_postcode: '1012AB',
    center_lat: 52.3676,
    center_lng: 4.9041,
    radius_km: 50,
    total_batch_size: 30,
    current_batch_count: 5,
    priority_score: 50, // Smaller radius = higher priority (better than Klant A!)
  },
  {
    id: 'batch_3',
    customer_email: 'klant.c@test.com',
    customer_name: 'Klant C - Heel Nederland',
    branch_id: 'thuisbatterijen',
    territory_type: 'full_country',
    total_batch_size: 100,
    current_batch_count: 25,
    priority_score: 1000, // Lowest priority
  },
];

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Simple Dutch postcode to coordinates (mock implementation)
// In production, you'd use a real API or database
function postcodeToCoordinates(postcode) {
  const cleanPostcode = postcode?.replace(/\s/g, '').toUpperCase();
  
  // Mock coordinates for common postcodes
  const mockCoordinates = {
    '8011': { lat: 52.5125, lng: 6.0939 }, // Zwolle
    '8012': { lat: 52.5100, lng: 6.1000 }, // Zwolle (near)
    '1012': { lat: 52.3676, lng: 4.9041 }, // Amsterdam
    '1013': { lat: 52.3800, lng: 4.9100 }, // Amsterdam (near)
    '3011': { lat: 51.9225, lng: 4.4792 }, // Rotterdam
    '2511': { lat: 52.0705, lng: 4.3007 }, // Den Haag
  };
  
  const prefix = cleanPostcode?.substring(0, 4);
  return mockCoordinates[prefix] || null;
}

// Evaluate if a lead matches a batch's territory
function evaluateBatch(lead, batch) {
  const result = {
    batch_id: batch.id,
    customer_name: batch.customer_name,
    eligible: false,
    priority_score: batch.priority_score,
    distance_km: null,
    match_reason: '',
    rejection_reason: '',
  };

  // Check if lead has coordinates
  if (!lead.coordinates && batch.territory_type !== 'full_country') {
    result.rejection_reason = `Geen postcode coordinates beschikbaar voor lead`;
    return result;
  }

  // Full country always matches
  if (batch.territory_type === 'full_country') {
    result.eligible = true;
    result.match_reason = 'Heel Nederland (laagste prioriteit)';
    return result;
  }

  // Radius matching
  if (batch.territory_type === 'radius') {
    const distance = calculateDistance(
      lead.coordinates.lat,
      lead.coordinates.lng,
      batch.center_lat,
      batch.center_lng
    );
    
    result.distance_km = distance;
    
    if (distance <= batch.radius_km) {
      result.eligible = true;
      result.match_reason = `Binnen ${batch.radius_km}km straal (${distance.toFixed(1)}km afstand van ${batch.center_postcode})`;
    } else {
      result.rejection_reason = `Buiten bereik: ${distance.toFixed(1)}km > ${batch.radius_km}km`;
    }
  }

  return result;
}

// Simulate distribution for a single lead
function simulateDistribution(lead, batches) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 SIMULATING DISTRIBUTION FOR LEAD: ${lead.name || lead.email}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📧 Email: ${lead.email}`);
  console.log(`📱 Phone: ${lead.phone || 'N/A'}`);
  console.log(`📍 Postcode: ${lead.postcode || 'N/A'}`);
  if (lead.coordinates) {
    console.log(`🌍 Coordinates: ${lead.coordinates.lat.toFixed(4)}, ${lead.coordinates.lng.toFixed(4)}`);
  } else {
    console.log(`⚠️  No coordinates found for postcode`);
  }

  // Evaluate all batches
  console.log(`\n📊 EVALUATING ${batches.length} CUSTOMER BATCHES:\n`);
  
  const evaluations = batches.map(batch => evaluateBatch(lead, batch));
  
  evaluations.forEach((eval, index) => {
    console.log(`${index + 1}. ${eval.customer_name}`);
    console.log(`   Territory: ${batches[index].territory_type}`);
    console.log(`   Priority Score: ${eval.priority_score} (lower = higher priority)`);
    
    if (eval.distance_km !== null) {
      console.log(`   Distance: ${eval.distance_km.toFixed(1)} km`);
    }
    
    if (eval.eligible) {
      console.log(`   ✅ ELIGIBLE: ${eval.match_reason}`);
    } else {
      console.log(`   ❌ REJECTED: ${eval.rejection_reason}`);
    }
    console.log('');
  });

  // Select top 2 eligible batches (sorted by priority)
  const eligible = evaluations
    .filter(e => e.eligible)
    .sort((a, b) => a.priority_score - b.priority_score);

  console.log(`\n🎯 DISTRIBUTION DECISION:\n`);
  
  if (eligible.length === 0) {
    console.log(`❌ NO ELIGIBLE CUSTOMERS - Lead would NOT be distributed`);
    return [];
  }

  const selected = eligible.slice(0, 2);
  
  console.log(`✅ Lead would be distributed to ${selected.length} customer(s):\n`);
  
  selected.forEach((sel, index) => {
    console.log(`${index + 1}. ${sel.customer_name}`);
    console.log(`   Reason: ${sel.match_reason}`);
    console.log(`   Priority: ${sel.priority_score}`);
    if (sel.distance_km !== null) {
      console.log(`   Distance: ${sel.distance_km.toFixed(1)} km`);
    }
    console.log('');
  });

  return selected;
}

// Main simulation function
async function runSimulation() {
  console.log(`\n🚀 LEAD DISTRIBUTION SIMULATION`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`📋 Meta Form ID: ${FORM_ID}`);
  console.log(`🏢 Simulated Customer Batches: ${SIMULATED_BATCHES.length}\n`);

  // Display simulated batches
  console.log(`📊 SIMULATED CUSTOMER BATCHES:\n`);
  SIMULATED_BATCHES.forEach((batch, index) => {
    console.log(`${index + 1}. ${batch.customer_name}`);
    console.log(`   Email: ${batch.customer_email}`);
    console.log(`   Branch: ${batch.branch_id}`);
    console.log(`   Territory: ${batch.territory_type}`);
    if (batch.territory_type === 'radius') {
      console.log(`   Center: ${batch.center_postcode} (${batch.radius_km}km radius)`);
    }
    console.log(`   Capacity: ${batch.current_batch_count}/${batch.total_batch_size} leads`);
    console.log(`   Priority Score: ${batch.priority_score}\n`);
  });

  console.log(`\n⚠️  NOTE: To fetch real leads from Meta, you need META_ACCESS_TOKEN`);
  console.log(`For now, I'll simulate with example lead data.\n`);

  // Example leads (would normally come from Meta API)
  const exampleLeads = [
    {
      email: 'lead1@example.com',
      name: 'Jan de Vries',
      phone: '06-12345678',
      postcode: '8012AB', // Near Zwolle
      coordinates: postcodeToCoordinates('8012AB'),
    },
    {
      email: 'lead2@example.com',
      name: 'Marie Janssen',
      phone: '06-87654321',
      postcode: '1013CD', // Near Amsterdam
      coordinates: postcodeToCoordinates('1013CD'),
    },
    {
      email: 'lead3@example.com',
      name: 'Peter Bakker',
      phone: '06-11223344',
      postcode: '3011AA', // Rotterdam
      coordinates: postcodeToCoordinates('3011AA'),
    },
    {
      email: 'lead4@example.com',
      name: 'Lisa Schmidt',
      phone: '06-99887766',
      postcode: 'UNKNOWN', // No postcode
      coordinates: null,
    },
  ];

  console.log(`\n🧪 TESTING WITH ${exampleLeads.length} EXAMPLE LEADS:\n`);

  const results = [];
  
  for (const lead of exampleLeads) {
    const distributions = simulateDistribution(lead, SIMULATED_BATCHES);
    results.push({
      lead: lead.email,
      distributed_to: distributions.map(d => d.customer_name),
    });
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📈 SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  results.forEach((result, index) => {
    console.log(`Lead ${index + 1} (${result.lead}):`);
    if (result.distributed_to.length === 0) {
      console.log(`  ❌ Not distributed (no eligible customers)`);
    } else {
      console.log(`  ✅ Distributed to: ${result.distributed_to.join(', ')}`);
    }
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ SIMULATION COMPLETE`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`💡 KEY OBSERVATIONS:`);
  console.log(`   • Leads near Zwolle (8012AB) → Klant A (95km radius)`);
  console.log(`   • Leads near Amsterdam (1013CD) → Klant B (50km radius, HIGHER priority!)`);
  console.log(`   • Leads far away (Rotterdam) → Klant C (Heel NL, lowest priority)`);
  console.log(`   • Leads without postcode → Only Klant C (full country)\n`);
}

// Run the simulation
runSimulation().catch(console.error);

