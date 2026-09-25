/** USA market — state-first lead finder */

export const COUNTRY = { name: 'United States', code: 'us' }

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

/** Major cities per state — [lat, lon] for accurate geocode */
export const CITIES_BY_STATE = {
  AL: { Birmingham: [33.5207, -86.8025], Montgomery: [32.3792, -86.3077], Mobile: [30.6954, -88.0399], Huntsville: [34.7304, -86.5861] },
  AK: { Anchorage: [61.2181, -149.9003], Fairbanks: [64.8378, -147.7164], Juneau: [58.3019, -134.4197] },
  AZ: { Phoenix: [33.4484, -112.074], Tucson: [32.2226, -110.9747], Mesa: [33.4152, -111.8315], Scottsdale: [33.4942, -111.9261], Chandler: [33.3062, -111.8413] },
  AR: { 'Little Rock': [34.7465, -92.2896], 'Fayetteville': [36.0626, -94.1574], 'Fort Smith': [35.3859, -94.3985] },
  CA: {
    'Los Angeles': [34.0522, -118.2437],
    'San Diego': [32.7157, -117.1611],
    'San Jose': [37.3382, -121.8863],
    'San Francisco': [37.7749, -122.4194],
    Sacramento: [38.5816, -121.4944],
    Fresno: [36.7378, -119.7871],
    Oakland: [37.8044, -122.2712],
    Irvine: [33.6846, -117.8265],
  },
  CO: { Denver: [39.7392, -104.9903], 'Colorado Springs': [38.8339, -104.8214], Aurora: [39.7294, -104.8319], Boulder: [40.015, -105.2705] },
  CT: { Bridgeport: [41.1865, -73.1952], 'New Haven': [41.3083, -72.9279], Hartford: [41.7658, -72.6734], Stamford: [41.0534, -73.5387] },
  DE: { Wilmington: [39.7391, -75.5398], Dover: [39.1582, -75.5244], Newark: [39.6837, -75.7497] },
  DC: { Washington: [38.9072, -77.0369] },
  FL: {
    Jacksonville: [30.3322, -81.6557],
    Miami: [25.7617, -80.1918],
    Tampa: [27.9506, -82.4572],
    Orlando: [28.5383, -81.3792],
    'St. Petersburg': [27.7676, -82.6403],
    Tallahassee: [30.4383, -84.2807],
  },
  GA: { Atlanta: [33.749, -84.388], Augusta: [33.4735, -82.0105], Savannah: [32.0809, -81.0912], Columbus: [32.461, -84.9877] },
  HI: { Honolulu: [21.3069, -157.8583], Hilo: [19.7074, -155.0885] },
  ID: { Boise: [43.615, -116.2023], Meridian: [43.6121, -116.3915], Nampa: [43.5407, -116.5635] },
  IL: { Chicago: [41.8781, -87.6298], Aurora: [41.7606, -88.3201], Naperville: [41.7508, -88.1535], Springfield: [39.7817, -89.6501] },
  IN: { Indianapolis: [39.7684, -86.1581], 'Fort Wayne': [41.0793, -85.1394], Evansville: [37.9716, -87.5711] },
  IA: { 'Des Moines': [41.5868, -93.625], 'Cedar Rapids': [41.9778, -91.6656], Davenport: [41.5236, -90.5776] },
  KS: { Wichita: [37.6872, -97.3301], 'Overland Park': [38.9822, -94.6708], Topeka: [39.0473, -95.6752] },
  KY: { Louisville: [38.2527, -85.7585], Lexington: [38.0406, -84.5037], 'Bowling Green': [36.9685, -86.4808] },
  LA: { 'New Orleans': [29.9511, -90.0715], 'Baton Rouge': [30.4515, -91.1871], Shreveport: [32.5252, -93.7502] },
  ME: { Portland: [43.6591, -70.2568], Lewiston: [44.1004, -70.2148], Bangor: [44.8016, -68.7712] },
  MD: { Baltimore: [39.2904, -76.6122], Frederick: [39.4143, -77.4105], Rockville: [39.084, -77.1528] },
  MA: { Boston: [42.3601, -71.0589], Worcester: [42.2626, -71.8023], Springfield: [42.1015, -72.5898], Cambridge: [42.3736, -71.1097] },
  MI: { Detroit: [42.3314, -83.0458], 'Grand Rapids': [42.9634, -85.6681], Warren: [42.5145, -83.0147], 'Ann Arbor': [42.2808, -83.743] },
  MN: { Minneapolis: [44.9778, -93.265], 'Saint Paul': [44.9537, -93.09], Rochester: [44.0121, -92.4802], Duluth: [46.7867, -92.1005] },
  MS: { Jackson: [32.2988, -90.1848], Gulfport: [30.3674, -89.0928], Biloxi: [30.396, -88.8853] },
  MO: { 'Kansas City': [39.0997, -94.5786], 'St. Louis': [38.627, -90.1994], Springfield: [37.209, -93.2923], Columbia: [38.9517, -92.3341] },
  MT: { Billings: [45.7833, -108.5007], Missoula: [46.8721, -113.994], 'Great Falls': [47.5053, -111.3008] },
  NE: { Omaha: [41.2565, -95.9345], Lincoln: [40.8136, -96.7026], Bellevue: [41.1544, -95.9146] },
  NV: { 'Las Vegas': [36.1699, -115.1398], Henderson: [36.0395, -114.9817], Reno: [39.5296, -119.8138] },
  NH: { Manchester: [42.9956, -71.4548], Nashua: [42.7654, -71.4676], Concord: [43.2081, -71.5376] },
  NJ: { Newark: [40.7357, -74.1724], 'Jersey City': [40.7282, -74.0776], Paterson: [40.9168, -74.1718], Trenton: [40.2206, -74.7597] },
  NM: { Albuquerque: [35.0844, -106.6504], 'Las Cruces': [32.3199, -106.7637], 'Santa Fe': [35.687, -105.9378] },
  NY: {
    'New York': [40.7128, -74.006],
    Buffalo: [42.8864, -78.8784],
    Rochester: [43.1566, -77.6088],
    Albany: [42.6526, -73.7562],
    Syracuse: [43.0481, -76.1474],
  },
  NC: { Charlotte: [35.2271, -80.8431], Raleigh: [35.7796, -78.6382], Greensboro: [36.0726, -79.792], Durham: [35.994, -78.8986], Asheville: [35.5951, -82.5515] },
  ND: { Fargo: [46.8772, -96.7898], Bismarck: [46.8083, -100.7837], 'Grand Forks': [47.9253, -97.0329] },
  OH: { Columbus: [39.9612, -82.9988], Cleveland: [41.4993, -81.6944], Cincinnati: [39.1031, -84.512], Toledo: [41.6528, -83.5379] },
  OK: { 'Oklahoma City': [35.4676, -97.5164], Tulsa: [36.154, -95.9928], Norman: [35.2226, -97.4395] },
  OR: { Portland: [45.5152, -122.6784], Salem: [44.9429, -123.0351], Eugene: [44.0521, -123.0868], Bend: [44.0582, -121.3153] },
  PA: { Philadelphia: [39.9526, -75.1652], Pittsburgh: [40.4406, -79.9959], Allentown: [40.6084, -75.4902], Harrisburg: [40.2732, -76.8867] },
  RI: { Providence: [41.824, -71.4128], Warwick: [41.7001, -71.4162], Cranston: [41.7798, -71.4373] },
  SC: { Charleston: [32.7765, -79.9311], Columbia: [34.0007, -81.0348], Greenville: [34.8526, -82.394] },
  SD: { 'Sioux Falls': [43.5446, -96.7311], 'Rapid City': [44.0805, -103.231], Aberdeen: [45.4647, -98.4865] },
  TN: { Nashville: [36.1627, -86.7816], Memphis: [35.1495, -90.049], Knoxville: [35.9606, -83.9207], Chattanooga: [35.0456, -85.3097] },
  TX: {
    Houston: [29.7604, -95.3698],
    'San Antonio': [29.4241, -98.4936],
    Dallas: [32.7767, -96.797],
    Austin: [30.2672, -97.7431],
    'Fort Worth': [32.7555, -97.3308],
    'El Paso': [31.7619, -106.485],
    Arlington: [32.7357, -97.1081],
  },
  UT: { 'Salt Lake City': [40.7608, -111.891], 'West Valley City': [40.6916, -112.0011], Provo: [40.2338, -111.6585] },
  VT: { Burlington: [44.4759, -73.2121], 'South Burlington': [44.467, -73.1709], Rutland: [43.6106, -72.9726] },
  VA: { 'Virginia Beach': [36.8529, -75.978], Norfolk: [36.8508, -76.2859], Richmond: [37.5407, -77.436], Arlington: [38.8816, -77.091] },
  WA: { Seattle: [47.6062, -122.3321], Spokane: [47.6588, -117.426], Tacoma: [47.2529, -122.4443], Bellevue: [47.6101, -122.2015] },
  WV: { Charleston: [38.3498, -81.6326], Huntington: [38.4192, -82.4452], Morgantown: [39.6295, -79.9559] },
  WI: { Milwaukee: [43.0389, -87.9065], Madison: [43.0731, -89.4012], 'Green Bay': [44.5133, -88.0133] },
  WY: { Cheyenne: [41.14, -104.8202], Casper: [42.8666, -106.3131], Laramie: [41.3114, -105.5911] },
}

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'shop', label: 'Shops / retail' },
  { id: 'restaurant', label: 'Food & drink' },
  { id: 'office', label: 'Offices / services' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'tourism', label: 'Hotels only' },
]

export function stateName(code) {
  return US_STATES.find((s) => s.code === code)?.name || code
}

export function citiesForState(code) {
  const map = CITIES_BY_STATE[code] || {}
  return Object.keys(map).sort((a, b) => a.localeCompare(b))
}

export function cityCoords(stateCode, city) {
  const map = CITIES_BY_STATE[stateCode]
  if (!map) return null
  if (map[city]) return map[city]
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(city || '').toLowerCase())
  return key ? map[key] : null
}
