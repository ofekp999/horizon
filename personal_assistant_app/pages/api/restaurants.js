// pages/api/restaurants.js
// מחזיר רשימת מסעדות מתוך OpenStreetMap (Nominatim + Overpass), ללא צורך ב-API key.
// שימוש הוגן: הוסיפי אימייל אמיתי בכותרת User-Agent כנדרש ע"י Nominatim.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

// בונה שורת כתובת מטאגים של OSM
function buildAddress(tags = {}) {
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:city"],
    tags["addr:postcode"]
  ].filter(Boolean);
  return parts.join(" ") || tags["addr:full"] || "";
}

export default async function handler(req, res) {
  try {
    const {
      location = "תל אביב",
      cuisine = "",       // לדוגמה: "italian" או "אסייתי"
      radius = "3000",    // מטרים סביב מרכז העיר
      max = "5",
      lang = "he"
    } = req.query;

    // 1) גיאוקודינג של העיר ל-lat/lon
    const geoUrl =
      `${NOMINATIM}?q=${encodeURIComponent(location)}` +
      `&format=json&limit=1&accept-language=${encodeURIComponent(lang)}`;

    const geoRes = await fetch(geoUrl, {
      headers: {
        // החליפי במייל שלך בהתאם לכללי השימוש של Nominatim
        "User-Agent": "horizon-personal-assistant/1.0 (contact: ofekp999@gmail.com)"
      }
    });
    const geoData = await geoRes.json();
    if (!Array.isArray(geoData) || geoData.length === 0) {
      return res.status(404).json({ error: "location_not_found" });
    }
    const { lat, lon } = geoData[0];

    // 2) שאילתת Overpass: מסעדות סביב הנ"צ, עם סינון אופציונלי לפי cuisine
    const cuisineFilter = cuisine
      ? `["cuisine"~"${cuisine.replace(/"/g, '\\"')}",i]`
      : "";
    const q = `
      [out:json][timeout:25];
      (
        node(around:${Number(radius)},${lat},${lon})["amenity"="restaurant"]${cuisineFilter};
        way(around:${Number(radius)},${lat},${lon})["amenity"="restaurant"]${cuisineFilter};
      );
      out center tags ${Number(max) * 4};
    `;

    const ovRes = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: new URLSearchParams({ data: q })
    });
    if (!ovRes.ok) {
      const t = await ovRes.text();
      return res.status(ovRes.status).json({ error: "overpass_error", details: t.slice(0, 500) });
    }
    const ovJson = await ovRes.json();
    const elements = Array.isArray(ovJson.elements) ? ovJson.elements : [];

    // 3) עיבוד תוצאות
    const items = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || "";
        if (!name) return null;

        const lat2 = el.lat ?? el.center?.lat;
        const lon2 = el.lon ?? el.center?.lon;

        return {
          name,
          address: buildAddress(tags),
          cuisine: tags.cuisine || null,
          lat: lat2,
          lon: lon2,
          osmType: el.type,
          osmId: el.id,
          mapsUrl: lat2 && lon2 ? `https://www.openstreetmap.org/?mlat=${lat2}&mlon=${lon2}#map=18/${lat2}/${lon2}` : null
        };
      })
      .filter(Boolean)
      // סינון כפילויות לפי שם
      .reduce((acc, r) => {
        if (!acc.some((x) => x.name === r.name)) acc.push(r);
        return acc;
      }, [])
      .slice(0, Number(max));

    return res.status(200).json({ query: { location, cuisine }, restaurants: items });
  } catch (e) {
    return res.status(500).json({ error: "server_error", message: String(e) });
  }
}


