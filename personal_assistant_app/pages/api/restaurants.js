// pages/api/restaurants.js
export default async function handler(req, res) {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const YELP_KEY = process.env.YELP_API_KEY; // אופציונלי
    if (!GOOGLE_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_MAPS_API_KEY' });
    }

    const {
      location = 'תל אביב',
      cuisine = '',
      requestedTime
    } = req.query;

    const when = requestedTime ? new Date(requestedTime) : new Date();

    // --- Google Places Text Search ---
    const gParams = new URLSearchParams({
      query: `restaurants ${cuisine || ''} ${location}`,
      key: GOOGLE_KEY,
      type: 'restaurant',
      language: 'he',
      region: 'il',
    });
    const gRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${gParams.toString()}`
    );
    const gJson = await gRes.json();
    const googleRestaurants = (gJson.results || []).map(p => ({
      name: p.name,
      address: p.formatted_address,
      rating: p.rating,
      price_level: p.price_level,
      place_id: p.place_id,
      source: 'google',
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
    }));

    // --- Yelp (אופציונלי; בישראל לפעמים דל) ---
    let yelpRestaurants = [];
    if (YELP_KEY) {
      const yParams = new URLSearchParams({
        location,
        categories: cuisine ? `restaurants,${cuisine}` : 'restaurants',
        limit: '20',
        locale: 'he_IL'
      });
      const yRes = await fetch(
        `https://api.yelp.com/v3/businesses/search?${yParams.toString()}`,
        { headers: { Authorization: `Bearer ${YELP_KEY}` } }
      );
      const yJson = await yRes.json();
      yelpRestaurants = (yJson.businesses || []).map(b => ({
        name: b.name,
        address: (b.location?.display_address || []).join(', '),
        rating: b.rating,
        price: b.price,
        yelp_id: b.id,
        source: 'yelp',
        lat: b.coordinates?.latitude,
        lng: b.coordinates?.longitude,
        categories: (b.categories || []).map(c => c.title),
        phone: b.phone,
        image_url: b.image_url,
      }));
    }

    // --- merge & dedupe ---
    const all = [...googleRestaurants, ...yelpRestaurants];
    const uniq = {};
    for (const r of all) {
      const key = (r.name + '|' + (r.address || '')).toLowerCase();
      if (!uniq[key]) uniq[key] = r;
    }
    const unique = Object.values(uniq);

    // --- זמינות משוערת (סטטיסטית) ---
    const period = (d) => {
      const dow = d.getDay(); // 0=Sunday
      const hour = d.getHours();
      if (dow === 5 || dow === 6) { // שישי/שבת
        if (hour >= 18 && hour <= 23) return 'weekend_evening';
      } else {
        if (hour >= 18 && hour <= 22) return 'weekday_evening';
        if (hour >= 11 && hour <= 15) return 'lunch_time';
      }
      return 'other';
    };
    const predict = (r, d) => {
      const p = period(d);
      const baseBusy =
        p === 'weekend_evening' ? 0.9 :
        p === 'weekday_evening' ? 0.7 :
        p === 'lunch_time' ? 0.6 : 0.5;
      let availability = 1 - baseBusy;
      const rating = r.rating ?? 3.5;
      if (rating > 4.5) availability *= 0.8;
      else if (rating < 3.5) availability *= 1.2;
      availability = Math.min(1, Math.max(0, availability));
      const rec =
        availability > 0.7 ? 'זמינות טובה - מומלץ להזמין' :
        availability > 0.4 ? 'זמינות בינונית - כדאי להזמין מראש' :
        'צפוי להיות עמוס - מומלץ לבחור זמן אחר';

      const earlier = new Date(d.getTime() - 60 * 60 * 1000);
      const later = new Date(d.getTime() + 2 * 60 * 60 * 1000);
      const pad = n => String(n).padStart(2, '0');

      return {
        availability_score: availability,
        confidence: 0.6,
        recommendation: rec,
        alternative_times: [
          `${pad(earlier.getHours())}:${pad(earlier.getMinutes())} (מוקדם יותר)`,
          `${pad(later.getHours())}:${pad(later.getMinutes())} (מאוחר יותר)`
        ]
      };
    };

    const enriched = unique.slice(0, 20).map(r => {
      const pred = predict(r, when);
      const base = r.rating ? r.rating / 5 : 0.6;
      const matchScore = Number((0.6 * base + 0.4).toFixed(2));
      return {
        ...r,
        availability_prediction: pred,
        match_score: matchScore,
        maps_url: r.lat && r.lng
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id || ''}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address || ''}`)}`
      };
    }).sort((a, b) =>
      (b.match_score * b.availability_prediction.availability_score) -
      (a.match_score * a.availability_prediction.availability_score)
    );

    return res.status(200).json({
      recommendations: enriched.slice(0, 10),
      requestedTime: when.toISOString(),
      location,
      source: { google: googleRestaurants.length, yelp: yelpRestaurants.length }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
}
