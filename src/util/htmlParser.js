/**
 * HTML Parser Utilities
 * Converts HTML strings to React elements for safe rendering
 */

import DOMPurify from 'dompurify';

/**
 * Parse HTML string and convert to React elements
 * Handles common HTML tags from Google Calendar descriptions
 * @param {string} html - HTML string to parse
 * @returns {Array|null} Array of React elements or null if no content
 */
export const parseHtmlToReact = (html) => {
  if (!html) return null;

  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });

  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;

  // Convert HTML nodes to React elements recursively
  const convertNodeToReact = (node, key = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const children = Array.from(node.childNodes).map((child, i) =>
        convertNodeToReact(child, i)
      );

      const props = { key };

      switch (node.tagName.toLowerCase()) {
        case 'b':
        case 'strong':
          return <strong {...props}>{children}</strong>;
        case 'i':
        case 'em':
          return <em {...props}>{children}</em>;
        case 'u':
          return <u {...props}>{children}</u>;
        case 'br':
          return <br {...props} />;
        case 'p':
          return <p {...props}>{children}</p>;
        case 'ul':
          return <ul {...props}>{children}</ul>;
        case 'ol':
          return <ol {...props}>{children}</ol>;
        case 'li':
          return <li {...props}>{children}</li>;
        case 'a':
          return (
            <a
              {...props}
              href={node.getAttribute('href')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          );
        case 'div':
        case 'span':
          return <span {...props}>{children}</span>;
        default:
          // For unknown tags, just render the children
          return <span {...props}>{children}</span>;
      }
    }

    return null;
  };

  const result = Array.from(tempDiv.childNodes).map((node, i) => convertNodeToReact(node, i));

  // Filter out empty text nodes
  const filtered = result.filter(element => {
    if (typeof element === 'string') {
      return element.trim().length > 0;
    }
    return true;
  });

  return filtered.length > 0 ? filtered : null;
};

/**
 * Strip all HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text without HTML tags
 */
export const stripHtmlTags = (html) => {
  if (!html) return '';

  // Sanitize first to prevent XSS, then extract text
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;
  return tempDiv.textContent || tempDiv.innerText || '';
};
