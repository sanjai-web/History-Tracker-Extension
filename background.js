// Background service worker for tracking navigation events

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['trackingEnabled'], (result) => {
    if (result.trackingEnabled === undefined) {
      chrome.storage.local.set({ trackingEnabled: true });
    }
  });
});

// Listen for navigation events
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only track main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  // Check if tracking is enabled
  const { trackingEnabled } = await chrome.storage.local.get(['trackingEnabled']);
  if (!trackingEnabled) return;

  // Get tab information
  try {
    const tab = await chrome.tabs.get(details.tabId);
    
    // Filter out extension pages and chrome:// URLs
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('extension://')) {
      return;
    }

    // Create link record
    const linkRecord = {
      id: Date.now() + Math.random(), // Unique ID
      title: tab.title || 'Untitled',
      url: tab.url,
      timestamp: new Date().toISOString()
    };

    // Get existing links
    const { links = [] } = await chrome.storage.local.get(['links']);
    
    // Add new link at the beginning (chronological order, newest first)
    links.unshift(linkRecord);
    
    // Store updated links
    await chrome.storage.local.set({ links });
    
    console.log('Link recorded:', linkRecord);
  } catch (error) {
    console.error('Error recording link:', error);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLinks') {
    chrome.storage.local.get(['links'], (result) => {
      sendResponse({ links: result.links || [] });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'deleteLink') {
    chrome.storage.local.get(['links'], (result) => {
      const links = result.links || [];
      const updatedLinks = links.filter(link => link.id !== request.linkId);
      chrome.storage.local.set({ links: updatedLinks }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (request.action === 'clearAll') {
    chrome.storage.local.set({ links: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'toggleTracking') {
    chrome.storage.local.set({ trackingEnabled: request.enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
