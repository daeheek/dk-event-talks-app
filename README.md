# BigQuery Release Notes Explorer

A premium, interactive web application built with **Python Flask** and **Vanilla HTML/CSS/JS** that fetches Google Cloud's BigQuery Release Notes feed, parses individual updates, and lets you share specific announcements directly on X/Twitter.

---

## ✨ Features

- **Granular Updates Segmenting**: Breaks down single-day multi-topic release notes into individual cards (Features, Announcements, Issues, Deprecations) using BeautifulSoup tag grouping.
- **Vibrant Dark-Theme Interface**: A premium responsive dashboard designed using CSS variables, custom scrollbars, and neon glow indicators.
- **Search & Category Pills**: Filter updates dynamically in real-time by keyword search or category tags (Features, Issues, etc.).
- **Timeline Anchor Navigation**: Side-panel navigation displaying recent release dates for quick smooth-scrolling.
- **Smart 5-Minute Cache Layer**: Caches parsed results in-memory to prevent rate-limits from Google Cloud servers, with a fallback recovery system.
- **Twitter / X Web Intent Composer**: Pre-populates a mock Twitter composer modal, dynamically formatting and truncating description text to adhere to X's 280-character limit (accounting for the 23-character t.co URL standard), complete with an SVG progress arc.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.15+, Flask, Requests, BeautifulSoup4
- **Frontend**: Plain Vanilla HTML5, CSS3 (featuring Grid, Flexbox, & Keyframe animations), modern JavaScript (ES6+)
- **Styling Details**: Space Grotesk / Plus Jakarta Sans typography, Glassmorphism panels, CSS Custom Variables.

---

## 📂 Project Directory Layout

```text
├── app.py                # Flask Server & Feed Parser
├── requirements.txt      # Python Dependencies
├── .gitignore            # Workspace version exclusions
├── README.md             # Project documentation (This file)
├── templates/
│   └── index.html        # Main interface template
└── static/
    ├── css/
    │   └── style.css     # Premium stylesheet
    └── js/
        └── main.js       # App controller & Twitter formatting API
```

---

## 🚀 Setup & Installation

### Prerequisites
Make sure you have Python 3 installed.

### 1. Clone & Navigate
```bash
git clone https://github.com/daeheek/dk-event-talks-app.git
cd dk-event-talks-app
```

### 2. Configure Virtual Environment & Dependencies
```bash
# Create venv
python3 -m venv .venv

# Activate venv
source .venv/bin/activate  # On Windows, use `.venv\Scripts\activate`

# Install required packages
pip install -r requirements.txt
```

### 3. Launch Flask Server
```bash
python app.py
```
*The server will start running locally at **http://127.0.0.1:5000**.*

---

## ⚙️ API Documentation

### Get Release Notes
Returns parsed, structured JSON elements representing the chronological feed entries.

- **URL**: `/api/releases`
- **Method**: `GET`
- **Query Parameters**:
  - `refresh=true` (Optional): Bypasses the 5-minute in-memory server cache to fetch a live feed from Google.
  
- **Example Response**:
```json
{
  "success": true,
  "source": "live",
  "last_fetched": 1781683400.125,
  "entries": [
    {
      "date": "June 16, 2026",
      "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_16_2026",
      "updated": "2026-06-16T00:00:00-07:00",
      "updates": [
        {
          "id": "june_16_2026_announcement_0",
          "type": "Announcement",
          "html": "<p>Table Explorer behavior is moving to the Reference panel...</p>",
          "text": "Table Explorer behavior is moving to the Reference panel..."
        }
      ]
    }
  ]
}
```
