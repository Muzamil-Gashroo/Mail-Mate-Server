const parseEmailBody = (payload) => {
  let plainText = "";
  let htmlText = "";

  const extractText = (part) => {
    if (part.body && part.body.data) {
      const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
      if (part.mimeType === 'text/plain') {
        plainText = decoded;
      } else if (part.mimeType === 'text/html') {
        htmlText = decoded;
      }
    }

    if (part.parts) {
      part.parts.forEach(subPart => extractText(subPart));
    }
  };

  extractText(payload);

  if (plainText) {
    return plainText
      .replace(/\u200C/g, '') 
      .replace(/\u200B/g, '') 
      .replace(/\u200D/g, '') 
      .replace(/\uFEFF/g, '') 
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ') 
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  } else if (htmlText) {
    
    return htmlText
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<head[^>]*>.*?<\/head>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\u200C/g, '')
      .replace(/\u200B/g, '')
      .replace(/\u200D/g, '')
      .replace(/\uFEFF/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }

  return "";
};

module.exports = { parseEmailBody };