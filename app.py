import time
import re
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# In-memory cache configuration
cache = {
    'data': None,
    'last_fetched': 0
}
CACHE_DURATION = 300  # 5 minutes in seconds
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_release_notes():
    """Fetches the Google BigQuery release notes XML and parses it into JSON-friendly structures."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Failed to fetch release notes from BigQuery Feed: {str(e)}")

    try:
        # Parse Atom Feed XML
        root = ET.fromstring(response.content)
    except Exception as e:
        raise RuntimeError(f"Failed to parse release notes XML: {str(e)}")

    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []

    for entry in root.findall('atom:entry', namespaces):
        title_elem = entry.find('atom:title', namespaces)
        title = title_elem.text.strip() if title_elem is not None and title_elem.text else ''
        
        updated_elem = entry.find('atom:updated', namespaces)
        updated = updated_elem.text.strip() if updated_elem is not None and updated_elem.text else ''
        
        link_elem = entry.find('atom:link[@rel="alternate"]', namespaces)
        if link_elem is None:
            link_elem = entry.find('atom:link', namespaces)
        link = link_elem.get('href') if link_elem is not None else ''
        
        content_elem = entry.find('atom:content', namespaces)
        content_html = content_elem.text if content_elem is not None and content_elem.text else ''
        
        # Parse the HTML content to break down updates by category/type (e.g. <h3>Announcement</h3>)
        soup = BeautifulSoup(content_html, 'html.parser')
        sub_updates = []
        
        # BigQuery Atom feed wraps headings in h3 elements for individual updates
        headings = soup.find_all('h3')
        
        if not headings:
            # If no <h3> header is found, treat the entire text content as a single general update
            text_content = soup.get_text(separator=' ').strip()
            text_content = re.sub(r'\s+', ' ', text_content)
            
            sub_updates.append({
                'id': f"{title.lower().replace(' ', '_').replace(',', '')}_general",
                'type': 'General',
                'html': str(soup),
                'text': text_content
            })
        else:
            for idx, h3 in enumerate(headings):
                update_type = h3.get_text().strip()
                
                # Gather all HTML siblings following this h3 up to the next h3
                sibling_html_parts = []
                sibling_text_parts = []
                
                sibling = h3.next_sibling
                while sibling and sibling.name != 'h3':
                    if sibling.name:  # It's an HTML tag (e.g. <p>, <ul>)
                        sibling_html_parts.append(str(sibling))
                        sibling_text_parts.append(sibling.get_text(separator=' ').strip())
                    elif isinstance(sibling, str) and sibling.strip():
                        # Plain text node
                        sibling_html_parts.append(sibling.strip())
                        sibling_text_parts.append(sibling.strip())
                    sibling = sibling.next_sibling
                
                # Reconstruct HTML and clean up raw text
                update_html = "".join(sibling_html_parts)
                update_text = " ".join(sibling_text_parts)
                update_text = re.sub(r'\s+', ' ', update_text).strip()
                
                # Generate a unique client-side selector ID for referencing
                sub_id = f"{title.lower().replace(' ', '_').replace(',', '')}_{update_type.lower()}_{idx}"
                
                sub_updates.append({
                    'id': sub_id,
                    'type': update_type,
                    'html': update_html,
                    'text': update_text
                })
        
        entries.append({
            'date': title,
            'updated': updated,
            'link': link,
            'updates': sub_updates
        })
        
    return entries

@app.route('/')
def home():
    """Renders the dashboard UI."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """API endpoint to get the parsed release notes, with caching."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    # Return cache if valid and not forcing a refresh
    if cache['data'] and not force_refresh and (now - cache['last_fetched'] < CACHE_DURATION):
        return jsonify({
            'success': True,
            'last_fetched': cache['last_fetched'],
            'source': 'cache',
            'entries': cache['data']
        })
        
    try:
        data = fetch_and_parse_release_notes()
        cache['data'] = data
        cache['last_fetched'] = now
        return jsonify({
            'success': True,
            'last_fetched': now,
            'source': 'live',
            'entries': data
        })
    except Exception as e:
        # Fall back to cache on failure, if cache exists
        if cache['data']:
            return jsonify({
                'success': True,
                'last_fetched': cache['last_fetched'],
                'source': 'fallback_cache',
                'error': str(e),
                'entries': cache['data']
            })
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
