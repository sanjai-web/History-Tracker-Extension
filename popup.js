// Popup script for Link Follow Extension

let links = [];
let trackingEnabled = true;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadLinks();
  await loadTrackingState();
  setupEventListeners();
  renderLinks();
});

// Load links from storage
async function loadLinks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['links'], (result) => {
      links = result.links || [];
      updateStats();
      resolve();
    });
  });
}

// Load tracking state
async function loadTrackingState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trackingEnabled'], (result) => {
      trackingEnabled = result.trackingEnabled !== false;
      updateTrackingUI();
      resolve();
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  const trackingToggle = document.getElementById('trackingToggle');
  const exportBtn = document.getElementById('exportBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  trackingToggle.addEventListener('change', handleTrackingToggle);
  exportBtn.addEventListener('click', exportToPDF);
  clearAllBtn.addEventListener('click', clearAllLinks);
}

// Handle tracking toggle
async function handleTrackingToggle(e) {
  trackingEnabled = e.target.checked;
  await chrome.storage.local.set({ trackingEnabled });
  updateTrackingUI();
}

// Update tracking UI
function updateTrackingUI() {
  const toggle = document.getElementById('trackingToggle');
  const statusText = document.getElementById('statusText');
  
  toggle.checked = trackingEnabled;
  statusText.textContent = trackingEnabled ? 'Tracking ON' : 'Tracking OFF';
  statusText.style.color = trackingEnabled ? '#4CAF50' : '#f5576c';
}

// Update stats
function updateStats() {
  document.getElementById('totalLinks').textContent = links.length;
}

// Render links
function renderLinks() {
  const linksList = document.getElementById('linksList');
  const emptyState = document.getElementById('emptyState');

  if (links.length === 0) {
    linksList.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  linksList.style.display = 'flex';
  emptyState.style.display = 'none';

  linksList.innerHTML = links.map(link => createLinkCard(link)).join('');

  // Add delete button listeners
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const linkId = parseFloat(e.target.dataset.linkId);
      deleteLink(linkId);
    });
  });
}

// Create link card HTML
function createLinkCard(link) {
  const formattedDate = formatTimestamp(link.timestamp);
  
  return `
    <div class="link-card">
      <div class="link-header">
        <div class="link-title">${escapeHtml(link.title)}</div>
        <button class="delete-btn" data-link-id="${link.id}">Delete</button>
      </div>
      <div class="link-url">${escapeHtml(link.url)}</div>
      <div class="link-timestamp">📅 ${formattedDate}</div>
    </div>
  `;
}

// Format timestamp
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Delete individual link
async function deleteLink(linkId) {
  links = links.filter(link => link.id !== linkId);
  await chrome.storage.local.set({ links });
  updateStats();
  renderLinks();
}

// Clear all links
async function clearAllLinks() {
  if (!confirm('Are you sure you want to clear all recorded links?')) {
    return;
  }
  
  links = [];
  await chrome.storage.local.set({ links: [] });
  updateStats();
  renderLinks();
}

// Export to PDF
function exportToPDF() {
  if (links.length === 0) {
    alert('No links to export!');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(102, 126, 234);
    doc.text('Link Follow Extension - History', 20, 20);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    doc.text(`Total Links: ${links.length}`, 20, 36);

    // Draw line
    doc.setDrawColor(102, 126, 234);
    doc.line(20, 40, 190, 40);

    let yPosition = 50;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;

    links.forEach((link, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      // Entry number
      doc.setFontSize(12);
      doc.setTextColor(102, 126, 234);
      doc.text(`${index + 1}.`, margin, yPosition);

      // Title
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(link.title, 160);
      doc.text(titleLines, margin + 8, yPosition);
      yPosition += titleLines.length * lineHeight;

      // URL
      doc.setFontSize(9);
      doc.setTextColor(102, 126, 234);
      const urlLines = doc.splitTextToSize(link.url, 160);
      doc.text(urlLines, margin + 8, yPosition);
      yPosition += urlLines.length * 5;

      // Timestamp
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`📅 ${formatTimestamp(link.timestamp)}`, margin + 8, yPosition);
      yPosition += 12;

      // Separator line
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPosition - 5, 190, yPosition - 5);
    });

    // Save PDF
    const filename = `link-history-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
}
