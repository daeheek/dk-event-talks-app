// Global State
let state = {
    releases: [],
    activeFilter: 'all',
    searchQuery: '',
    selectedUpdate: null
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    spinnerIcon: document.getElementById('spinnerIcon'),
    cacheIndicator: document.getElementById('cacheIndicator'),
    
    // Stats
    statTotalDates: document.getElementById('statTotalDates'),
    statFeatures: document.getElementById('statFeatures'),
    statAnnouncements: document.getElementById('statAnnouncements'),
    statIssues: document.getElementById('statIssues'),
    
    // Controls
    searchInput: document.getElementById('searchInput'),
    filterPills: document.querySelectorAll('.pill'),
    timelineNav: document.getElementById('timelineNav'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    
    // Feed sections
    skeletonLoader: document.getElementById('skeletonLoader'),
    notesFeed: document.getElementById('notesFeed'),
    emptyState: document.getElementById('emptyState'),
    
    // Modal
    tweetModal: document.getElementById('tweetModal'),
    tweetContent: document.getElementById('tweetContent'),
    charCount: document.getElementById('charCount'),
    charProgress: document.getElementById('charProgress'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalTweetBtn: document.getElementById('modalTweetBtn'),
    
    // Toasts
    toastContainer: document.getElementById('toastContainer'),
    
    // CSV Export
    exportCsvBtn: document.getElementById('exportCsvBtn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases();
});

// Setup Events
function setupEventListeners() {
    // Refresh Button Click
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Export to CSV Click
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', handleExportCSV);
    }

    // Search Input with Debounce
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            renderFeed();
        }, 200);
    });

    // Filter Pill Clicks
    elements.filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            // Update active state in UI
            elements.filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            // Update state and re-render
            state.activeFilter = pill.getAttribute('data-filter');
            renderFeed();
        });
    });

    // Clear Filters Empty State Button
    elements.clearFiltersBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        
        elements.filterPills.forEach(p => p.classList.remove('active'));
        document.getElementById('filterAll').classList.add('active');
        state.activeFilter = 'all';
        
        renderFeed();
    });

    // Event Delegation for dynamic "Tweet Update" and "Copy" buttons inside feed
    elements.notesFeed.addEventListener('click', (e) => {
        const tweetBtn = e.target.closest('.btn-share-tweet');
        const copyBtn = e.target.closest('.btn-copy-clipboard');
        
        if (tweetBtn) {
            const dateStr = tweetBtn.getAttribute('data-date');
            const updateId = tweetBtn.getAttribute('data-id');
            openTweetComposer(dateStr, updateId);
        } else if (copyBtn) {
            const dateStr = copyBtn.getAttribute('data-date');
            const updateId = copyBtn.getAttribute('data-id');
            handleCopyUpdate(dateStr, updateId, copyBtn);
        }
    });

    // Modal Close handlers
    elements.modalCloseBtn.addEventListener('click', closeTweetModal);
    elements.modalCancelBtn.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });

    // Textarea Input character counter
    elements.tweetContent.addEventListener('input', updateCharCounter);

    // Modal Tweet Button Send Action
    elements.modalTweetBtn.addEventListener('click', handleTweetPublish);
}

// Fetch Release Notes from API
async function fetchReleases(forceRefresh = false) {
    toggleLoading(true);
    
    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.success) {
            state.releases = result.entries;
            
            // Update UI components
            updateStats(result.entries);
            updateCacheIndicator(result.last_fetched, result.source);
            renderTimelineNav(result.entries);
            renderFeed();
            
            if (forceRefresh) {
                showToast('Release notes successfully refreshed!', 'success');
            }
        } else {
            throw new Error(result.error || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(`Error: ${error.message}. Displaying cached version if available.`, 'error');
        
        if (state.releases.length === 0) {
            showEmptyState(true, 'Connection error. Could not retrieve release notes.');
        }
    } finally {
        toggleLoading(false);
    }
}

// Toggle Feed Loading State
function toggleLoading(isLoading) {
    if (isLoading) {
        elements.spinnerIcon.classList.add('spin');
        elements.refreshBtn.disabled = true;
        elements.skeletonLoader.style.display = 'flex';
        elements.notesFeed.style.display = 'none';
        elements.emptyState.style.display = 'none';
    } else {
        elements.spinnerIcon.classList.remove('spin');
        elements.refreshBtn.disabled = false;
        elements.skeletonLoader.style.display = 'none';
    }
}

// Update Last Fetched Label
function updateCacheIndicator(timestamp, source) {
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    let sourceLabel = 'Cache';
    if (source === 'live') sourceLabel = 'Live Feed';
    if (source === 'fallback_cache') sourceLabel = 'Fallback Cache';
    
    elements.cacheIndicator.textContent = `${sourceLabel}: ${timeStr}`;
}

// Update Stat Counters in Header
function updateStats(entries) {
    elements.statTotalDates.textContent = entries.length;
    
    let features = 0;
    let announcements = 0;
    let issues = 0;
    
    entries.forEach(entry => {
        entry.updates.forEach(up => {
            const type = up.type.toLowerCase();
            if (type.includes('feature')) features++;
            else if (type.includes('announcement')) announcements++;
            else if (type.includes('issue') || type.includes('deprecation') || type.includes('breaking')) issues++;
        });
    });
    
    elements.statFeatures.textContent = features;
    elements.statAnnouncements.textContent = announcements;
    elements.statIssues.textContent = issues;
}

// Render Recent Timeline Navigation links
function renderTimelineNav(entries) {
    elements.timelineNav.innerHTML = '';
    
    // Take top 8 entries to avoid cluttering navigation sidebar
    const recent = entries.slice(0, 10);
    
    if (recent.length === 0) {
        elements.timelineNav.innerHTML = '<p class="text-muted">No recent items</p>';
        return;
    }
    
    recent.forEach(entry => {
        const cleanId = entry.date.replace(/[^a-zA-Z0-9]/g, '_');
        const link = document.createElement('a');
        link.href = `#card_${cleanId}`;
        link.className = 'timeline-nav-item';
        link.textContent = entry.date;
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(`card_${cleanId}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                
                // Highlight active nav item
                document.querySelectorAll('.timeline-nav-item').forEach(item => {
                    item.classList.remove('active-scroll');
                });
                link.classList.add('active-scroll');
            }
        });
        
        elements.timelineNav.appendChild(link);
    });
}

// Render Content Feed
function renderFeed() {
    elements.notesFeed.innerHTML = '';
    let matchesFound = 0;
    
    state.releases.forEach(entry => {
        // Filter sub-updates
        const filteredUpdates = entry.updates.filter(up => {
            const matchesFilter = state.activeFilter === 'all' || 
                                 (state.activeFilter === 'Issue' && (up.type === 'Issue' || up.type === 'Deprecation' || up.type === 'Breaking Change')) ||
                                 up.type === state.activeFilter;
                                 
            const matchesSearch = !state.searchQuery || 
                                 up.type.toLowerCase().includes(state.searchQuery) || 
                                 up.text.toLowerCase().includes(state.searchQuery) ||
                                 entry.date.toLowerCase().includes(state.searchQuery);
                                 
            return matchesFilter && matchesSearch;
        });
        
        // Only render the card if it has matching updates
        if (filteredUpdates.length > 0) {
            matchesFound += filteredUpdates.length;
            const cleanId = entry.date.replace(/[^a-zA-Z0-9]/g, '_');
            
            const cardEl = document.createElement('article');
            cardEl.className = 'release-card';
            cardEl.id = `card_${cleanId}`;
            
            // Header
            let headerHTML = `
                <div class="release-header">
                    <h2 class="release-title">${entry.date}</h2>
                    ${entry.link ? `
                        <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="release-link">
                            <span>View official docs</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                            </svg>
                        </a>
                    ` : ''}
                </div>
            `;
            
            // Sub updates body
            let updatesHTML = '<div class="release-updates">';
            filteredUpdates.forEach(up => {
                let badgeClass = 'badge-general';
                if (up.type === 'Feature') badgeClass = 'badge-feature';
                else if (up.type === 'Announcement') badgeClass = 'badge-announcement';
                else if (up.type === 'Issue') badgeClass = 'badge-issue';
                else if (up.type === 'Deprecation' || up.type === 'Breaking Change') badgeClass = 'badge-deprecation';
                
                updatesHTML += `
                    <div class="update-item" data-type="${up.type}">
                        <div class="update-meta">
                            <span class="badge ${badgeClass}">${up.type}</span>
                        </div>
                        <div class="update-body">
                            ${up.html}
                        </div>
                        <div class="update-actions">
                            <button class="btn btn-copy-clipboard" data-date="${entry.date}" data-id="${up.id}" aria-label="Copy update to clipboard">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                                <span>Copy</span>
                            </button>
                            <button class="btn btn-share-tweet" data-date="${entry.date}" data-id="${up.id}" aria-label="Share update on X">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                                <span>Tweet Update</span>
                            </button>
                        </div>
                    </div>
                `;
            });
            updatesHTML += '</div>';
            
            cardEl.innerHTML = headerHTML + updatesHTML;
            elements.notesFeed.appendChild(cardEl);
        }
    });
    
    if (matchesFound > 0) {
        elements.notesFeed.style.display = 'flex';
        elements.emptyState.style.display = 'none';
    } else {
        elements.notesFeed.style.display = 'none';
        showEmptyState(false);
    }
}

// Show Empty / Error state
function showEmptyState(isError, customMsg) {
    elements.notesFeed.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    
    const title = elements.emptyState.querySelector('h2');
    const desc = elements.emptyState.querySelector('p');
    
    if (isError) {
        title.textContent = 'Unable to Load Feed';
        desc.textContent = customMsg || 'Could not fetch BigQuery release notes XML feed.';
        elements.clearFiltersBtn.textContent = 'Retry Loading';
        elements.clearFiltersBtn.onclick = () => fetchReleases(true);
    } else {
        title.textContent = 'No updates match your search';
        desc.textContent = 'Try searching for generic terms or reset the active filter pills.';
        elements.clearFiltersBtn.textContent = 'Reset Filters';
        elements.clearFiltersBtn.onclick = () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            elements.filterPills.forEach(p => p.classList.remove('active'));
            document.getElementById('filterAll').classList.add('active');
            state.activeFilter = 'all';
            renderFeed();
        };
    }
}

// Format the default pre-filled tweet text adhering to X limits
function formatTweetText(type, date, text, link) {
    const hashtags = ' #BigQuery #GoogleCloud';
    
    // Treat link length as exactly 23 characters (Twitter t.co URL standard)
    const twitterLinkLen = 23;
    const padding = 6; // spaces, colon, parentheses
    const staticLen = type.length + date.length + hashtags.length + twitterLinkLen + padding;
    
    const maxTextLen = 280 - staticLen;
    let cleanText = text.trim();
    
    if (cleanText.length > maxTextLen) {
        // Truncate text nicely to fit
        cleanText = cleanText.substring(0, maxTextLen - 3) + '...';
    }
    
    return `BigQuery [${type}] Update (${date}): ${cleanText}${hashtags}\n\n${link}`;
}

// Open modal and prepopulate tweet text
function openTweetComposer(dateStr, updateId) {
    // Locate the matching update in state
    let foundUpdate = null;
    let parentLink = '';
    
    for (const entry of state.releases) {
        if (entry.date === dateStr) {
            foundUpdate = entry.updates.find(up => up.id === updateId);
            parentLink = entry.link || '';
            break;
        }
    }
    
    if (!foundUpdate) {
        showToast('Error finding update text to share.', 'error');
        return;
    }
    
    state.selectedUpdate = {
        type: foundUpdate.type,
        date: dateStr,
        text: foundUpdate.text,
        link: parentLink
    };
    
    // Format default text
    const formattedText = formatTweetText(
        state.selectedUpdate.type,
        state.selectedUpdate.date,
        state.selectedUpdate.text,
        state.selectedUpdate.link
    );
    
    elements.tweetContent.value = formattedText;
    updateCharCounter();
    
    // Show Modal
    elements.tweetModal.style.display = 'flex';
    elements.tweetContent.focus();
    
    // Disable background scrolling
    document.body.style.overflow = 'hidden';
}

// Close Tweet Modal
function closeTweetModal() {
    elements.tweetModal.style.display = 'none';
    state.selectedUpdate = null;
    document.body.style.overflow = '';
}

// Update Twitter Composer Character Indicator
function updateCharCounter() {
    const text = elements.tweetContent.value;
    
    // Calculate length, handling URL shortening standard
    // Twitter counts any URL as exactly 23 characters. Let's find URLs in the text and adjust count.
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlPattern) || [];
    
    let rawTextWithoutUrls = text;
    urls.forEach(url => {
        rawTextWithoutUrls = rawTextWithoutUrls.replace(url, '');
    });
    
    // Actual character length = length without urls + 23 characters for each URL found
    const charLen = rawTextWithoutUrls.length + (urls.length * 23);
    const charsRemaining = 280 - charLen;
    
    elements.charCount.textContent = charsRemaining;
    
    // Handle status color classes
    if (charsRemaining < 0) {
        elements.charCount.style.color = '#ef4444';
        elements.modalTweetBtn.disabled = true;
    } else if (charsRemaining <= 20) {
        elements.charCount.style.color = '#f59e0b';
        elements.modalTweetBtn.disabled = false;
    } else {
        elements.charCount.style.color = 'var(--text-muted)';
        elements.modalTweetBtn.disabled = false;
    }
    
    // Render progress circle SVG
    const radius = 11;
    const circumference = 2 * Math.PI * radius; // 69.115
    elements.charProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const percent = Math.min(charLen / 280, 1);
    const offset = circumference - (percent * circumference);
    elements.charProgress.style.strokeDashoffset = offset;
    
    // Change progress indicator stroke color based on remaining chars
    if (charsRemaining < 0) {
        elements.charProgress.style.stroke = '#ef4444';
    } else if (charsRemaining <= 20) {
        elements.charProgress.style.stroke = '#f59e0b';
    } else {
        elements.charProgress.style.stroke = '#1da1f2';
    }
}

// Handle Publish button click
function handleTweetPublish() {
    const text = elements.tweetContent.value;
    if (text.trim() === '') {
        showToast('Tweet content cannot be empty!', 'error');
        return;
    }
    
    // Open X Share Intent window
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast('Redirected to Twitter composer!', 'success');
}

// Custom Premium Toast Notification System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
    `;
    if (type === 'success') {
        icon = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        `;
    } else if (type === 'error') {
        icon = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Automatically hide after 4 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// Copy specific update text to clipboard
async function handleCopyUpdate(dateStr, updateId, buttonElement) {
    let foundUpdate = null;
    let parentLink = '';
    
    for (const entry of state.releases) {
        if (entry.date === dateStr) {
            foundUpdate = entry.updates.find(up => up.id === updateId);
            parentLink = entry.link || '';
            break;
        }
    }
    
    if (!foundUpdate) {
        showToast('Error finding update text to copy.', 'error');
        return;
    }
    
    // Format text beautifully for clipboard sharing
    const formattedText = `BigQuery [${foundUpdate.type}] Update (${dateStr}): ${foundUpdate.text}\n\nInfo: ${parentLink}`;
    
    try {
        await navigator.clipboard.writeText(formattedText);
        
        // Show success indicator inside button
        const originalHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style="color: #10b981;">Copied!</span>
        `;
        buttonElement.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        buttonElement.style.background = 'rgba(16, 185, 129, 0.05)';
        
        setTimeout(() => {
            buttonElement.innerHTML = originalHtml;
            buttonElement.style.borderColor = '';
            buttonElement.style.background = '';
        }, 2000);
        
        showToast('Update content copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard. Please select manually.', 'error');
    }
}

// Export currently visible (filtered/searched) release notes to CSV
function handleExportCSV() {
    let csvRows = [];
    
    // CSV Header row
    csvRows.push(['Date', 'Category', 'Permalink', 'Description'].map(h => `"${h}"`).join(','));
    
    let totalExported = 0;
    
    state.releases.forEach(entry => {
        const filteredUpdates = entry.updates.filter(up => {
            const matchesFilter = state.activeFilter === 'all' || 
                                 (state.activeFilter === 'Issue' && (up.type === 'Issue' || up.type === 'Deprecation' || up.type === 'Breaking Change')) ||
                                 up.type === state.activeFilter;
                                 
            const matchesSearch = !state.searchQuery || 
                                 up.type.toLowerCase().includes(state.searchQuery) || 
                                 up.text.toLowerCase().includes(state.searchQuery) ||
                                 entry.date.toLowerCase().includes(state.searchQuery);
                                 
            return matchesFilter && matchesSearch;
        });
        
        filteredUpdates.forEach(up => {
            // Escape double quotes inside text by doubling them per CSV spec
            const cleanText = up.text.replace(/"/g, '""');
            const cleanDate = entry.date.replace(/"/g, '""');
            const cleanType = up.type.replace(/"/g, '""');
            const cleanLink = (entry.link || '').replace(/"/g, '""');
            
            csvRows.push(`"${cleanDate}","${cleanType}","${cleanLink}","${cleanText}"`);
            totalExported++;
        });
    });
    
    if (totalExported === 0) {
        showToast('No updates to export with current filters.', 'error');
        return;
    }
    
    // Trigger file download
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Successfully exported ${totalExported} updates to CSV!`, 'success');
}
