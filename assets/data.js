// ------- Benchmarks & presets
window.BENCH_KMPL = {"City car":20,"Hatchback":17,"Compact SUV":16,"Sedan":16,"SUV":14,"Crossover":12,"MPV/SUV":15,"Scooter":50};

window.CITY_TO_STATE={
  "Delhi":"Delhi","New Delhi":"Delhi","Mumbai":"Maharashtra","Pune":"Maharashtra","Bengaluru":"Karnataka",
  "Chennai":"Tamil Nadu","Kolkata":"West Bengal","Hyderabad":"Telangana","Kochi":"Kerala","Ahmedabad":"Gujarat",
  "Jaipur":"Rajasthan","Chandigarh":"Chandigarh","Gurugram":"Haryana","Noida":"Uttar Pradesh","Lucknow":"Uttar Pradesh",
  "Bhopal":"Madhya Pradesh","Patna":"Bihar","Ranchi":"Jharkhand","Bhubaneswar":"Odisha","Visakhapatnam":"Andhra Pradesh",
  "Guwahati":"Assam","Dehradun":"Uttarakhand","Shimla":"Himachal Pradesh"
};

window.STATE_BENCH={
  "Delhi":{petrol:95,tariff:6.0}, "Maharashtra":{petrol:105,tariff:8.0}, "Karnataka":{petrol:104,tariff:7.0},
  "Tamil Nadu":{petrol:102,tariff:6.5}, "West Bengal":{petrol:106,tariff:8.0}, "Telangana":{petrol:107,tariff:7.5},
  "Kerala":{petrol:107,tariff:7.2}, "Gujarat":{petrol:95,tariff:7.1}, "Rajasthan":{petrol:105,tariff:8.1},
  "Punjab":{petrol:98,tariff:6.5}, "Haryana":{petrol:96,tariff:6.8}, "Uttar Pradesh":{petrol:95,tariff:6.7},
  "Madhya Pradesh":{petrol:107,tariff:7.8}, "Bihar":{petrol:107,tariff:7.0}, "Jharkhand":{petrol:105,tariff:7.0},
  "Odisha":{petrol:104,tariff:7.0}, "Andhra Pradesh":{petrol:108,tariff:7.8}, "Assam":{petrol:101,tariff:6.9},
  "Uttarakhand":{petrol:99,tariff:6.8}, "Chandigarh":{petrol:97,tariff:6.4}
};

window.CITY_PRESETS = Object.keys(CITY_TO_STATE).map(name=>{
  const st=CITY_TO_STATE[name]; const b=STATE_BENCH[st]||{petrol:100,tariff:7};
  return {id:name.toLowerCase().replace(/\s+/g,'-'),name,petrol:b.petrol,tariff:b.tariff};
});

// ------- Models (sample set; extend freely) — ids double as local image filenames (assets/img/<id>.jpg)
window.MODELS_CARS=[
  {id:"mahindra-be6",brand:"Mahindra",model:"BE 6",price_lakh:18.90,segment:"SUV",eff_kwh_per_100km:16.5,range_km:557},
  {id:"mahindra-xev9e",brand:"Mahindra",model:"XEV 9e",price_lakh:21.90,segment:"SUV",eff_kwh_per_100km:17.0,range_km:542},
  {id:"tata-harrier-ev",brand:"Tata",model:"Harrier EV",price_lakh:21.49,segment:"SUV",eff_kwh_per_100km:18.5,range_km:538},
  {id:"tata-punch-ev",brand:"Tata",model:"Punch EV",price_lakh:9.99,segment:"Compact SUV",eff_kwh_per_100km:13.5,range_km:315},
  {id:"mg-windsor-ev",brand:"MG",model:"Windsor EV",price_lakh:17.00,segment:"Hatchback",eff_kwh_per_100km:14.0,range_km:350},
  {id:"tata-nexon-ev",brand:"Tata",model:"Nexon EV",price_lakh:12.49,segment:"SUV",eff_kwh_per_100km:16.0,range_km:489},
  {id:"tata-tiago-ev",brand:"Tata",model:"Tiago EV",price_lakh:7.99,segment:"Hatchback",eff_kwh_per_100km:13.0,range_km:223},
  {id:"mg-comet-ev",brand:"MG",model:"Comet EV",price_lakh:7.50,segment:"City car",eff_kwh_per_100km:11.0,range_km:230},
  {id:"byd-atto3",brand:"BYD",model:"Atto 3",price_lakh:24.99,segment:"SUV",eff_kwh_per_100km:17.5,range_km:420},
  {id:"byd-seal",brand:"BYD",model:"Seal",price_lakh:41.00,segment:"Sedan",eff_kwh_per_100km:15.5,range_km:650},
  {id:"byd-sealion7",brand:"BYD",model:"Sealion 7",price_lakh:48.90,segment:"SUV",eff_kwh_per_100km:18.0,range_km:610},
  {id:"hy-ioniq5",brand:"Hyundai",model:"Ioniq 5",price_lakh:45.95,segment:"Crossover",eff_kwh_per_100km:17.0,range_km:631},
  {id:"bmw-ix1-lwb",brand:"BMW",model:"iX1 (LWB)",price_lakh:49.00,segment:"SUV",eff_kwh_per_100km:18.0,range_km:531},
  {id:"kia-carens-clavis-ev",brand:"Kia",model:"Carens Clavis EV",price_lakh:17.99,segment:"MPV/SUV",eff_kwh_per_100km:16.5,range_km:404},
  {id:"mg-zs-ev",brand:"MG",model:"ZS EV",price_lakh:23.00,segment:"SUV",eff_kwh_per_100km:17.0,range_km:461},
  {id:"citroen-ec3",brand:"Citroën",model:"eC3",price_lakh:11.60,segment:"Hatchback",eff_kwh_per_100km:16.0,range_km:320},
  {id:"tata-tigor-ev",brand:"Tata",model:"Tigor EV",price_lakh:12.49,segment:"Sedan",eff_kwh_per_100km:13.8,range_km:315},
  {id:"mahindra-xuv400",brand:"Mahindra",model:"XUV400",price_lakh:16.00,segment:"SUV",eff_kwh_per_100km:16.5,range_km:375},
  {id:"byd-e6",brand:"BYD",model:"e6",price_lakh:29.15,segment:"MPV/SUV",eff_kwh_per_100km:15.5,range_km:520},
  {id:"hyundai-kona",brand:"Hyundai",model:"Kona Electric",price_lakh:24.00,segment:"SUV",eff_kwh_per_100km:15.8,range_km:484}
];

window.MODELS_SCOOTERS=[
  {id:"ola-s1-pro",brand:"Ola",model:"S1 Pro",price_lakh:1.36,segment:"Scooter",eff_kwh_per_100km:5.5,range_km:242},
  {id:"ola-s1-x",brand:"Ola",model:"S1 X",price_lakh:1.00,segment:"Scooter",eff_kwh_per_100km:5.0,range_km:125},
  {id:"ather-450x",brand:"Ather",model:"450X",price_lakh:1.64,segment:"Scooter",eff_kwh_per_100km:5.0,range_km:161},
  {id:"tvs-iqube",brand:"TVS",model:"iQube",price_lakh:1.05,segment:"Scooter",eff_kwh_per_100km:5.0,range_km:145},
  {id:"bajaj-chetak",brand:"Bajaj",model:"Chetak",price_lakh:1.22,segment:"Scooter",eff_kwh_per_100km:5.2,range_km:113}
];

// Optional: explicit image map if a filename differs from id
window.IMG_MAP = {
  // "tata-nexon-ev": "nexon-2024.jpg"
};
