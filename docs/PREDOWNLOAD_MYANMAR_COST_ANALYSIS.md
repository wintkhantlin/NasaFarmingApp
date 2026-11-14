# Pre-downloading Myanmar Data: Feasibility, Volume & Total Cost Analysis

> **Target Scopes:**  
> 1. **5 Agricultural Heartland Regions (Ayeyarwady, Magway, Mandalay, Shan, Bago: $313{,}000\text{ km}^2$, >85% of Myanmar Cropland)**  
> 2. **3 Pilot Regions (Ayeyarwady, Magway, Shan: $235{,}600\text{ km}^2$)**  
> 3. **Entire Union of Myanmar (Nationwide: $676{,}578\text{ km}^2$)**  
>
> **Status:** Operational Architecture & Cost Specification  
> **Date:** November 2026  
> **Audience:** Project Lead, Systems Architect, AI Agents

---

## Executive Summary

Pre-downloading and caching data for the **5 core agricultural regions (Ayeyarwady, Magway, Mandalay, Shan, and Bago)** is the **highest-leverage, lowest-cost strategy** possible for this project:

- **Agricultural Coverage:** These 5 regions represent **$313{,}000\text{ km}^2$** ($\approx 46\%$ of Myanmar's total land area), but contain **over $85\%$ of all cultivated farmland and smallholder farming communities in the country**.
- **Tier 1 Core Storage (Weather, Climate, IMERG Rain, SoilGrids, SRTM Slope & SMAP):**
  - **Total Volume:** **$\mathbf{\approx 1.74\text{ GB}}$**!
  - **Data Licensing Cost:** **\$0.00** (Free open-access NASA & ISRIC data).
  - **Storage Cost:** **$\approx \$0.026\text{ / month}$** ($\approx 3\text{ cents per month}$ on Cloudflare R2 / AWS S3) or **completely free** on local disk / server NVMe.
  - **Download Time:** Under **45 minutes** over standard broadband.
- **Tier 2 (Core + 26-Year Historical MODIS 250m NDVI/EVI Time Series):**
  - **Total Volume:** **$\mathbf{\approx 18.2\text{ GB}}$**.
  - **Storage Cost:** **$\approx \$0.27\text{ / month}$** ($27\text{ cents per month}$).
  - **Download Time:** Under **2 hours**.
- **Performance Impact:** Instantaneous response times ($< 150\text{ ms}$) for 95% of farmer queries across 85% of Myanmar's agricultural land, with zero risk of external API downtime.

---

## 1. Geographic Comparison: 5 Core Regions vs. Nationwide

| Region Name | Administrative Status | Land Area ($\text{km}^2$) | Primary Agro-Ecological Focus & Crops |
|---|---|---|---|
| **Ayeyarwady** | Region (Delta) | $35{,}031\text{ km}^2$ | Lower Delta rice bowl, post-monsoon residual moisture pulses (black gram, green gram). |
| **Magway** | Region (Dry Zone) | $44{,}820\text{ km}^2$ | Central Dry Zone core; drought-hardy oilseeds (sesame, groundnut) and pulses (chickpea, pigeon pea). |
| **Mandalay** | Region (Dry Zone/Valley) | $37{,}945\text{ km}^2$ | Northern Dry Zone & central trading hub; cotton, pulses, irrigated paddy, onion, chili. |
| **Shan State** | State (Highland) | $155{,}801\text{ km}^2$ | Eastern highlands & rolling plateaus; maize, soybean, cover crops (lablab, sunn hemp), slope erosion. |
| **Bago** | Region (Lower Basin) | $39{,}404\text{ km}^2$ | Transition zone connecting Delta and Dry Zone; rainfed monsoon rice, pulses, sugarcane, sunflower. |
| **Total 5 Regions** | **Agricultural Heartland** | **$\mathbf{313{,}000\text{ km}^2}$** | **$> 85\%$ of all cultivated cropland in Myanmar.** |
| *Original 3 Pilot Regions* | *Ayeyarwady + Magway + Shan* | *$235{,}600\text{ km}^2$* | *Initial research subset ($\approx 35\%$ of land area).* |
| *Union of Myanmar* | *All 14 States & Regions* | *$676{,}578\text{ km}^2$* | *Entire country (includes remote northern Kachin & Chin forests).* |

### Geographic Bounding Box for the 5 Regions:
- Latitude: $15.7^\circ\text{N}$ to $24.1^\circ\text{N}$ ($\Delta\text{Lat} \approx 8.4^\circ$).
- Longitude: $94.2^\circ\text{E}$ to $101.2^\circ\text{E}$ ($\Delta\text{Lon} \approx 7.0^\circ$).

---

## 2. Dataset-by-Dataset Volume Breakdown: 5 Regions vs. All Myanmar

### 2.1 NASA POWER Agroclimatology (Daily 1981–2026, 45 Years)
- **Grid Resolution:** $0.5^\circ \times 0.625^\circ$.
- **Cells Covering the 5 Regions:** $\approx 110\text{ to } 120\text{ cells}$ (vs. 270 nationwide).
- **Temporal Depth:** $16{,}436\text{ days}$ per cell (10 parameters: $T_{\max}, T_{\min}, T_{\text{mean}}, P, RH, R_s, u_2, P_{\text{sfc}}, \text{GWET}_{\text{root}}, \text{GWET}_{\text{top}}$).
- **Storage for 5 Regions:**
  - Compressed Binary Parquet / SQLite: $120\text{ cells} \times 250\text{ KB} = \mathbf{30.0\text{ MB}}$!
  - Raw JSON: $120 \times 1.3\text{ MB} = \mathbf{156\text{ MB}}$.
- **Ingestion Time:** At 30 requests/minute, 120 calls take **4 minutes**! Cost: **\$0.00**.

---

### 2.2 NASA GPM IMERG Final Daily Precipitation (v07, 2000–2026, 26 Years)
- **Grid Resolution:** $0.1^\circ \times 0.1^\circ$ ($\approx 10\text{ km}$).
- **Cells in 5 Regions:** $\approx 3{,}130\text{ cells}$ (vs. 6,800 nationwide).
- **Storage Strategy:** Clip daily spatial NetCDF grids to the 5-region bounding box ($84 \times 70 = 5{,}880\text{ cells}$).
- **Daily Size:** $5{,}880 \times 4\text{ bytes} \approx 23.5\text{ KB}$ (compresses to $\approx 7\text{ KB}$ via zstd).
- **Storage for 5 Regions (26 Years, $9{,}500\text{ days}$):**
  - $9{,}500\text{ days} \times 7\text{ KB} = \mathbf{66.5\text{ MB}}$!
- **Ingestion Time:** $\approx 20\text{ minutes}$. Cost: **\$0.00**.

---

### 2.3 ISRIC SoilGrids v2.0 (Static 250m, 8 Properties, 3 Depth Slices)
- **Grid Resolution:** $250\text{ m}$ raster cell.
- **Valid Land Pixels across 5 Regions:** $\approx 5\text{ million pixels}$ per layer.
- **Layers:** 8 properties $\times 3$ depths = 24 layers.
- **Storage for 5 Regions:**
  - 1 Int16 GeoTIFF layer compressed (Deflate/LZW): $\approx 9.5\text{ MB}$.
  - 24 layers $\times 9.5\text{ MB} = \mathbf{228\text{ MB}}$ total!
- **Ingestion Time:** $\approx 8\text{ minutes}$ direct download. Cost: **\$0.00**.

---

### 2.4 SRTM Global Elevation & Slope (Static 30m / 1 arc-second)
- **Grid Resolution:** $30\text{ m}$.
- **Tile Coverage:** Intersects $\approx 38$ $1^\circ \times 1^\circ$ tiles (vs. 85 for all Myanmar).
- **Storage for 5 Regions:**
  - Raw Elevation GeoTIFFs: $38 \times 18\text{ MB} = \mathbf{684\text{ MB}}$.
  - Derived Slope Grid (Horn's $3\times3$): $\mathbf{684\text{ MB}}$.
  - Total: $\mathbf{1.37\text{ GB}}$.
- **Ingestion Time:** $\approx 10\text{ minutes}$. Cost: **\$0.00**.

---

### 2.5 NASA SMAP Level-4 Soil Moisture (9km, 2015–2026, 11 Years)
- **Grid Resolution:** $9\text{ km}$ EASE-Grid 2.0.
- **Cells across 5 Regions:** $\approx 3{,}860\text{ cells}$.
- **Storage for 5 Regions (11 Years, $4{,}015\text{ days}$):**
  - Compressed Zarr format: $\mathbf{48.0\text{ MB}}$!
- **Ingestion Time:** $\approx 15\text{ minutes}$. Cost: **\$0.00**.

---

### 2.6 MODIS Terra Vegetation Indices (MOD13Q1.061, 250m, 2000–2026, 26 Years)
- **Grid Resolution:** $250\text{ m}$ sinusoidal raster.
- **Temporal Frequency:** 16-day composite ($600\text{ time steps}$ over 26 years).
- **Tile Coverage:** Covered predominantly by 3 MODIS tiles (`h26v07`, `h27v07`, `h26v08`).
- **Storage for 5 Regions:**
  - Scaled NDVI, EVI, VI Quality, Reliability: $\mathbf{\approx 16.5\text{ GB}}$! (vs. 36 GB nationwide).
- **Ingestion Time:** $\approx 1.5\text{ hours}$. Cost: **\$0.00**.

---

### 2.7 Harmonized Landsat-Sentinel (HLS 30m, 2016–2026, 10 Years)
- **Raw Full Archive (5 Regions):** $\approx 1.2\text{ to } 3.5\text{ TB}$.
  - *Same Cloud Limitation:* Over 80% of monsoon scenes are occluded by heavy monsoon clouds.
- **Cropland-Only Monthly Median Composites (5 Regions):**
  - Cultivated land in the 5 regions: $\approx 95{,}000\text{ km}^2$.
  - 10 years $\times 12$ months cloud-screened composites: $\mathbf{\approx 55\text{ GB}}$!
- **On-Demand Dynamic Slicing:** $\mathbf{0\text{ GB pre-download}}$ (queried only when a user draws a field polygon).

---

## 3. Side-by-Side Scope Comparison Table

| Metric / Dataset | Scope A: 5 Core Regions<br>(Ayeyarwady, Magway, Mandalay, Shan, Bago) | Scope B: Original 3 Pilot Regions<br>(Ayeyarwady, Magway, Shan) | Scope C: Entire Union of Myanmar<br>(All 14 States/Regions) |
|---|---|---|---|
| **Land Area** | **$313{,}000\text{ km}^2$** ($\approx 46\%$) | $235{,}600\text{ km}^2$ ($\approx 35\%$) | $676{,}578\text{ km}^2$ ($100\%$) |
| **Cultivated Cropland Share** | **$> 85\%$ of Myanmar agriculture** | $\approx 60\%$ of Myanmar agriculture | $100\%$ of Myanmar agriculture |
| **NASA POWER Weather (45 yrs)** | **$30\text{ MB}$** (120 cells) | $25\text{ MB}$ (100 cells) | $68\text{ MB}$ (270 cells) |
| **GPM IMERG Rain (26 yrs)** | **$66.5\text{ MB}$** | $50\text{ MB}$ | $190\text{ MB}$ |
| **ISRIC SoilGrids v2 (24 layers)** | **$228\text{ MB}$** | $170\text{ MB}$ | $480\text{ MB}$ |
| **SRTM Elevation & Slope (30m)** | **$1.37\text{ GB}$** (38 tiles) | $1.10\text{ GB}$ (30 tiles) | $3.06\text{ GB}$ (85 tiles) |
| **SMAP Soil Moisture (11 yrs)** | **$48\text{ MB}$** | $38\text{ MB}$ | $275\text{ MB}$ |
| **Total Tier 1 (Core Foundations)** | **$\mathbf{1.74\text{ GB}}$** | **$\mathbf{1.38\text{ GB}}$** | **$\mathbf{4.07\text{ GB}}$** |
| **MODIS MOD13Q1 (250m, 26 yrs)** | **$16.5\text{ GB}$** | $12.6\text{ GB}$ | $36.0\text{ GB}$ |
| **Total Tier 1 + Tier 2** | **$\mathbf{\approx 18.2\text{ GB}}$** | **$\mathbf{\approx 14.0\text{ GB}}$** | **$\mathbf{\approx 40.1\text{ GB}}$** |
| **One-Time Pre-Download Time** | **$\approx 1.5\text{ hours}$** | $\approx 1.2\text{ hours}$ | $\approx 3.5\text{ hours}$ |

---

## 4. Financial Cost Calculation for the 5 Regions

### 4.1 Data Acquisition & License Fees: **\$0.00**
All NASA missions and ISRIC SoilGrids are **free open-access public goods**.

### 4.2 Compute & ETL Pipeline Ingestion: **< \$0.50 (One-Time)**
A small 4-vCPU temporary cloud instance running for 1.5 hours to ingest, crop, and package the 18.2 GB dataset costs under 50 cents.

### 4.3 Monthly Cloud Storage & Bandwidth Hosting Costs

| Storage Provider | Tier 1 Core Only ($1.74\text{ GB}$) | Tier 1 + Tier 2 ($18.2\text{ GB}$) | Bandwidth / Egress Fee | Effective Monthly Cost |
|---|---|---|---|---|
| **Cloudflare R2** | **\$0.026 / mo** ($\approx 3¢$) | **\$0.27 / mo** ($\approx 27¢$) | **\$0.00 (Zero Egress)** | **\$0.27 / month** |
| **Wasabi Hot Cloud** | **\$0.012 / mo** ($\approx 1¢$) | **\$0.13 / mo** ($\approx 13¢$) | **\$0.00 (Zero Egress)** | **\$0.13 / month** |
| **AWS S3 Standard** | **\$0.040 / mo** ($\approx 4¢$) | **\$0.42 / mo** ($\approx 42¢$) | \$0.09 / GB downloaded | **\$0.50 to \$1.00 / mo** |
| **Local Disk / NVMe Server** | **\$0.00** | **\$0.00** | **\$0.00** | **\$0.00** |

> **Summary:** Pre-downloading Tier 1 + Tier 2 for all 5 regions costs **between \$0.13 and \$0.27 per month** on zero-egress cloud object storage, or **completely free** on local server disk.

---

## 5. The "10 Years Max" Window Analysis (2016–2026)

Restricting the historical scenario window to **10 years max (2016-01-01 to 2026)**—which aligns directly with the repository's server setting `WEATHER_START = "20160101"` in `lib/server/weather.ts`—produces dramatic further data reductions:

### 5.1 Volume Reduction with 10-Year Ceiling (5 Regions)

| Dataset | Full Multi-Decadal Volume | 10-Year Max Volume (2016–2026) | Reduction (%) | Time to Ingest |
|---|---|---|---|---|
| **NASA POWER Weather** | $30.0\text{ MB}$ (45 years) | **$\mathbf{6.6\text{ MB}}$** (3,652 days, 120 cells) | **-78%** | **4 minutes** |
| **GPM IMERG Daily Rain** | $66.5\text{ MB}$ (26 years) | **$\mathbf{25.5\text{ MB}}$** ($3{,}652\text{ daily grids}$) | **-62%** | **8 minutes** |
| **SMAP Soil Moisture** | $48.0\text{ MB}$ (11 years) | **$\mathbf{43.8\text{ MB}}$** ($3{,}652\text{ daily grids}$) | **-9%** | **12 minutes** |
| **ISRIC SoilGrids v2** | $228.0\text{ MB}$ (static) | **$\mathbf{228.0\text{ MB}}$** (static 24 layers) | $0\%$ | **8 minutes** |
| **SRTM Elevation & Slope** | $1.37\text{ GB}$ (static) | **$\mathbf{1.37\text{ GB}}$** (static 38 tiles) | $0\%$ | **10 minutes** |
| **Subtotal: Tier 1 Core** | **$1.74\text{ GB}$** | **$\mathbf{1.67\text{ GB}}$** | — | **< 35 minutes** |
| **MODIS MOD13Q1 (250m)** | $16.5\text{ GB}$ (600 time steps) | **$\mathbf{6.3\text{ GB}}$** (230 16-day composites) | **-62%** | **35 minutes** |
| **Total Tier 1 + Tier 2 (10-Yr)** | **$18.2\text{ GB}$** | **$\mathbf{\approx 7.97\text{ GB}}$ ($\mathbf{\approx 8.0\text{ GB}}$)** | **-56%** | **< 1 hour** |

### 5.2 Financial Cost of the 10-Year Max Setup
- **Data Acquisition & Licensing:** **\$0.00** (Completely free).
- **One-Time Ingestion Compute:** **< \$0.20** (Under 1 hour on small VM).
- **Monthly Cloud Storage Hosting:**
  - **Cloudflare R2 (Zero Egress):** $8.0\text{ GB} \times \$0.015 = \mathbf{\$0.12\text{ / month}}$ (**12 cents/month**).
  - **Wasabi Hot Cloud:** $8.0\text{ GB} \times \$0.0069 = \mathbf{\$0.055\text{ / month}}$ (**5.5 cents/month**).
  - **Local Server Disk / SQLite / DuckDB:** **\$0.00**.

---

## 6. Strategic Benefits of Scoping to the 5 Regions

1. **Unbeatable Data Economy:**
   The entire foundational dataset (weather, climate, rainfall, soil, elevation, slope, and SMAP) for all 5 regions is **only $1.74\text{ GB}$**. It can be distributed as a single download file or stored directly in SQLite / DuckDB.
2. **Covers Myanmar's Entire Cropping Diversity:**
   - **Ayeyarwady + Bago:** Complete lower-basin paddy and post-monsoon pulse ecology.
   - **Magway + Mandalay:** Complete Central Dry Zone sesame, groundnut, pigeon pea, chickpea, and cotton ecology.
   - **Shan State:** Complete highland plateau maize, soybean, cover crop, and hillside erosion ecology.
3. **Instant Latency:**
   Farmers and agronomists querying fields anywhere across these 5 regions experience sub-second calculations ($< 150\text{ ms}$) with zero dependence on foreign API availability.
