// /lib/parseDoc.js
// Exports a single async function: parseDoc(doc)
// Returns: HTML string

// Helper function to detect linked images in text content
function detectLinkedImages(doc) {
  const linkedImages = [];
  let imageIndex = 0;
  const isImageUrl = (url) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
           lowerUrl.includes('googleusercontent.com') ||
           lowerUrl.includes('drive.google.com/file/d/') ||
           lowerUrl.includes('imgur.com') ||
           lowerUrl.includes('image');
  };
  const searchContent = (content, location = 'document') => {
    content?.forEach((block, blockIndex) => {
      if (block.paragraph?.elements) {
        block.paragraph.elements.forEach((element, elementIndex) => {
          if (element.textRun) {
            if (element.textRun.textStyle?.link?.url) {
              const url = element.textRun.textStyle.link.url;
              if (isImageUrl(url)) {
                linkedImages.push({
                  type: 'hyperlink',
                  url: url,
                  text: element.textRun.content?.trim(),
                  location: `${location}-block-${blockIndex}-element-${elementIndex}`,
                  index: imageIndex++
                });
              }
            }
            const textContent = element.textRun.content || '';
            const urlRegex = /https?:\/\/[^\s]+/g;
            let match;
            while ((match = urlRegex.exec(textContent)) !== null) {
              const url = match[0];
              if (isImageUrl(url)) {
                linkedImages.push({
                  type: 'text-url',
                  url: url,
                  text: textContent.trim(),
                  location: `${location}-block-${blockIndex}-element-${elementIndex}`,
                  index: imageIndex++
                });
              }
            }
          }
        });
      }
      if (block.table?.tableRows) {
        block.table.tableRows.forEach((row, rowIndex) => {
          row.tableCells?.forEach((cell, cellIndex) => {
            searchContent(cell.content, `table-row-${rowIndex}-cell-${cellIndex}`);
          });
        });
      }
    });
  };
  searchContent(doc.body?.content);
  return linkedImages;
}

// Helper function to process text elements with formatting
function processTextElement(element, linkedImages) {
  if (element.textRun) {
    let content = element.textRun.content;
    const textStyle = element.textRun.textStyle || {};
    if (textStyle.link?.url) {
      const linkedImage = linkedImages.find(img => img.url === textStyle.link.url);
      if (linkedImage) {
        return processLinkedImage(linkedImage);
      }
    }
    const urlRegex = /https?:\/\/[^\s]+/g;
    content = content.replace(urlRegex, (url) => {
      const linkedImage = linkedImages.find(img => img.url === url);
      if (linkedImage) {
        return processLinkedImage(linkedImage);
      }
      return url;
    });
    if (textStyle.bold) {
      content = `<strong>${content}</strong>`;
    }
    if (textStyle.italic) {
      content = `<em>${content}</em>`;
    }
    if (textStyle.underline) {
      content = `<u>${content}</u>`;
    }
    if (textStyle.strikethrough) {
      content = `<s>${content}</s>`;
    }
    // Handle subscripts and superscripts based on baselineOffset
    if (textStyle.baselineOffset) {
      if (textStyle.baselineOffset === 'SUBSCRIPT') {
        content = `<sub>${content}</sub>`;
      } else if (textStyle.baselineOffset === 'SUPERSCRIPT') {
        content = `<sup>${content}</sup>`;
      }
    }
    if (textStyle.link?.url && !linkedImages.find(img => img.url === textStyle.link.url)) {
      content = `<a href="${textStyle.link.url}" target="_blank">${content}</a>`;
    }
    let style = "";
    if (textStyle.fontSize?.magnitude) {
      style += `font-size: ${textStyle.fontSize.magnitude}pt;`;
    }
    if (textStyle.foregroundColor?.color?.rgbColor) {
      const color = textStyle.foregroundColor.color.rgbColor;
      const rgb = `rgb(${Math.round((color.red || 0) * 255)}, ${Math.round(
        (color.green || 0) * 255
      )}, ${Math.round((color.blue || 0) * 255)})`;
      style += `color: ${rgb};`;
    }
    if (style) {
      content = `<span style="${style}">${content}</span>`;
    }
    return content;
  }
  if (element.pageBreak) {
    return '<div class="page-break"></div>';
  }
  if (element.columnBreak) {
    return '<div class="column-break"></div>';
  }
  if (element.footnoteReference) {
    return `<sup class="footnote-ref">${element.footnoteReference.footnoteNumber}</sup>`;
  }
  if (element.horizontalRule) {
    return '<hr class="my-4">';
  }
  return "";
}

function processParagraph(paragraph, linkedImages = [], isInTableCell = false) {
  if (!paragraph) return "";
  const paragraphStyle = paragraph.paragraphStyle || {};
  const namedStyleType = paragraphStyle.namedStyleType;
  const textContent =
    paragraph.elements
      ?.map((element) => processTextElement(element, linkedImages))
      .join("") || "";
  const formattedTextContent = textContent.replace(/[\n\x0B]/g, '<br>');
  if (!formattedTextContent.trim()) {
    return "<br>";
  }
  const bullet = paragraph.bullet;
  if (bullet) {
    const nestingLevel = bullet.nestingLevel || 0;
    const listId = bullet.listId;
    const indent = nestingLevel > 0 ? ` style="margin-left: ${nestingLevel * 20}px;"` : "";
    return `<li class="mb-1 leading-relaxed"${indent}>${formattedTextContent}</li>`;
  }
  switch (namedStyleType) {
    case "TITLE":
      return `<h1 class="text-4xl font-bold mb-6 text-center text-blue-700">${formattedTextContent}</h1>`;
    case "SUBTITLE":
      return `<h2 class="text-2xl font-semibold mb-4 text-center text-blue-700">${formattedTextContent}</h2>`;
    case "HEADING_1":
      return `<h1 class="text-3xl font-bold mb-4 mt-8 text-blue-700 border-b-2 border-blue-200 pb-2">${formattedTextContent}</h1>`;
    case "HEADING_2":
      return `<h2 class="text-2xl font-semibold mb-3 mt-6 text-red-600">${formattedTextContent}</h2>`;
    case "HEADING_3":
      return `<h3 class="text-xl font-semibold mb-2 mt-4 text-green-600">${formattedTextContent}</h3>`;
    case "HEADING_4":
      return `<h4 class="text-lg font-medium mb-2 mt-3 text-blue-600">${formattedTextContent}</h4>`;
    case "HEADING_5":
      return `<h5 class="text-base font-medium mb-1 mt-2 text-blue-600">${formattedTextContent}</h5>`;
    case "HEADING_6":
      return `<h6 class="text-sm font-medium mb-1 mt-2 text-blue-600">${formattedTextContent}</h6>`;
    default:
      let classes = isInTableCell ? "leading-relaxed" : "mb-4 leading-relaxed";
      switch (paragraphStyle.alignment) {
        case "CENTER":
          classes += " text-center";
          break;
        case "END":
          classes += " text-right";
          break;
        case "JUSTIFIED":
          classes += " text-justify";
          break;
        default:
          classes += " text-left";
      }
      return `<p class="${classes}">${formattedTextContent}</p>`;
  }
}

async function processTable(table, linkedImages = [], doc, imageIndexObj) {
  if (!table?.tableRows?.length) {
    return "";
  }

  const rows = table.tableRows;
  
  // Build a grid to track cell positions and spans
  // grid[row][col] = { cell, colspan, rowspan } or 'occupied' if covered by a span from above
  const grid = [];

  // First pass: determine table dimensions by looking at first row
  const firstRowCells = rows[0]?.tableCells || [];
  let maxCols = 0;
  for (const cell of firstRowCells) {
    const style = cell.tableCellStyle || {};
    const colspan = Math.max(1, style.columnSpan || 1);
    maxCols += colspan;
  }

  // Second pass: place cells in grid
  for (let r = 0; r < rows.length; r++) {
    grid[r] = grid[r] || [];
    const cells = rows[r].tableCells || [];
    
    // Place cells directly at their column index - Google Docs gives them in order
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
      const cell = cells[cellIndex];
      const style = cell.tableCellStyle || {};
      const colspan = Math.max(1, style.columnSpan || 1);
      const rowspan = Math.max(1, style.rowSpan || 1);
      
      // Place cell at its column index (if not already occupied)
      if (grid[r][cellIndex] !== 'occupied') {
        grid[r][cellIndex] = { cell, colspan, rowspan };
        
        // Mark cells covered by this cell's span as occupied
        for (let rr = r; rr < r + rowspan; rr++) {
          grid[rr] = grid[rr] || [];
          for (let cc = cellIndex; cc < cellIndex + colspan; cc++) {
            // Skip the cell's own position
            if (rr === r && cc === cellIndex) continue;
            
            grid[rr][cc] = 'occupied';
          }
        }
      }
    }
  }

  // Third pass: render the HTML
  let html = '<div class="overflow-scroll w-100vw"><table class="w-full border-collapse mb-6" style="border: 1px solid black; background-color: white;">';

  for (let r = 0; r < rows.length; r++) {
    html += "<tr>";

    for (let c = 0; c < maxCols; c++) {
      const entry = grid[r][c];

      // Skip occupied cells (they're covered by a rowspan from above)
      if (entry === 'occupied') {
        continue;
      }

      // Skip undefined cells (shouldn't happen with correct logic)
      if (!entry) {
        continue;
      }

      const { cell, colspan, rowspan } = entry;

      // Build cell content
      const parts = [];
      for (const block of cell.content || []) {
        if (block.paragraph) {
          if (block.paragraph.positionedObjectIds?.length) {
            const positionedElements = await Promise.all(
              block.paragraph.positionedObjectIds.map(async (positionedObjectId) => {
                return await processPositionedObject(positionedObjectId, doc.positionedObjects);
              })
            );
            parts.push(positionedElements.join(''));
          }

          const hasInlineObjects = block.paragraph.elements?.some((el) => el.inlineObjectElement);
          if (hasInlineObjects) {
            const elements = await Promise.all(
              (block.paragraph.elements || []).map(async (element) => {
                if (element.inlineObjectElement) {
                  return await processInlineObject(
                    element.inlineObjectElement.inlineObjectId,
                    doc.inlineObjects,
                    imageIndexObj.index++
                  );
                }
                return processTextElement(element, linkedImages);
              })
            );
            parts.push(elements.join(''));
          } else {
            parts.push(processParagraph(block.paragraph, linkedImages, true));
          }
        } else if (block.table) {
          parts.push(await processTable(block.table, linkedImages, doc, imageIndexObj));
        }
      }

      const cellContent = parts.join('') || "";
      
      // Add colspan and rowspan attributes if needed
      const attrs = [];
      if (colspan > 1) attrs.push(`colspan="${colspan}"`);
      if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`);
      
      html += `<td${attrs.length ? ' ' + attrs.join(' ') : ''} style="border: 1px solid black; padding: 0.75rem; background-color: white;">${cellContent}</td>`;
    }

    html += "</tr>";
  }

  html += "</table></div>";
  return html;
}

function processLinkedImage(imageData) {
  const { url, text } = imageData;
  const shouldUseProxy = url.includes('googleusercontent.com') || url.includes('drive.google.com');
  const imageUrl = shouldUseProxy ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
  return `<div class="my-6 flex justify-center">
            <img src="${imageUrl}" alt="${text || 'Linked Image'}" class="max-w-full h-auto rounded-lg shadow-md" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <div style="display: none;" class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
              </svg>
              <p class="mt-2 text-sm text-gray-600 font-medium">Linked Image</p>
              <p class="text-xs text-gray-500 mt-1">Image could not be loaded</p>
            </div>
            ${text && text !== url ? `<div class="text-center"><p class="text-sm text-gray-600 mt-2 italic">${text}</p></div>` : ""}
          </div>`;
}

// Helper function to process inline objects (images)
async function processInlineObject(inlineObjectId, inlineObjects, imageIndex) {
  if (!inlineObjects || !inlineObjects[inlineObjectId]) return "";
  const inlineObject = inlineObjects[inlineObjectId];
  const embeddedObject = inlineObject.inlineObjectProperties?.embeddedObject;
  if (!embeddedObject) return "";

  if (embeddedObject?.imageProperties) {
    const title = embeddedObject.title || "Image";
    let imageUri = embeddedObject.imageProperties.contentUri;

    // Try to build size style (convert doc points -> px approx 1pt = 1.333px)
    const size = inlineObject.inlineObjectProperties?.embeddedObject?.size;
    const sizeParts = [];
    let hasHeight = false;
    if (size?.width?.magnitude) {
      const widthPx = Math.round(size.width.magnitude * 1.333);
      sizeParts.push(`width: ${widthPx}px;`);
    }
    if (size?.height?.magnitude) {
      const heightPx = Math.round(size.height.magnitude * 1.333);
      sizeParts.push(`height: ${heightPx}px;`);
      hasHeight = true;
    }
    const baseStyle = sizeParts.join('') + 'display:block;margin:0 auto;max-width:100%;';
    const finalStyle = hasHeight ? baseStyle : baseStyle + 'height:auto;';

    if (imageUri) {
      const proxyUrl = imageUri.includes('googleusercontent.com')
        ? `/api/image-proxy?url=${encodeURIComponent(imageUri)}`
        : imageUri;

      return `<div class="my-6 flex justify-center"><img src="${proxyUrl}" alt="${title}" class="rounded-lg shadow-md" style="${finalStyle}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><div style="display:none;" class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center"><p class="mt-2 text-sm text-gray-600 font-medium">Image: ${title}</p><p class="text-xs text-gray-500 mt-1">Image temporairement indisponible</p></div>${title !== "Image" ? `<div class="text-center"><p class="text-sm text-gray-600 mt-2 italic">${title}</p></div>` : ""}</div>`;
    }
  }
  return "";
}

// Helper function to process positioned objects (images positioned in specific locations)
async function processPositionedObject(positionedObjectId, positionedObjects) {
  if (!positionedObjects || !positionedObjects[positionedObjectId]) return "";
  const positionedObject = positionedObjects[positionedObjectId];
  const embeddedObject = positionedObject.positionedObjectProperties?.embeddedObject;
  if (!embeddedObject) return "";

  if (embeddedObject.imageProperties) {
    const imageUri = embeddedObject.imageProperties.contentUri;
    const title = embeddedObject.title || "Image";

    const sizeParts = [];
    let hasHeight = false;
    if (embeddedObject.size) {
      const width = embeddedObject.size.width;
      const height = embeddedObject.size.height;
      if (width?.magnitude) {
        const widthPx = Math.round(width.magnitude * 1.333);
        sizeParts.push(`width: ${widthPx}px;`);
      }
      if (height?.magnitude) {
        const heightPx = Math.round(height.magnitude * 1.333);
        sizeParts.push(`height: ${heightPx}px;`);
        hasHeight = true;
      }
    }
    const baseStyle = sizeParts.join('') + 'display:block;margin:0 auto;max-width:100%;';
    const finalStyle = hasHeight ? baseStyle : baseStyle + 'height:auto;';

    if (imageUri) {
      const proxyUrl = imageUri.includes('googleusercontent.com')
        ? `/api/image-proxy?url=${encodeURIComponent(imageUri)}`
        : imageUri;
      return `<div class="my-6 flex justify-center"><img src="${proxyUrl}" alt="${title}" style="${finalStyle}" class="rounded-lg shadow-md" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><div style="display:none;" class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center"><p class="mt-2 text-sm text-gray-600 font-medium">Image: ${title}</p><p class="text-xs text-gray-500 mt-1">L'image ne peut pas être affichée</p></div>${title !== "Image" ? `<div class="text-center"><p class="text-sm text-gray-600 mt-2 italic">${title}</p></div>` : ""}</div>`;
    }
  }
  return "";
}

// Main exported function
export async function parseDoc(doc) {
  let imageIndex = 0;
  const imageIndexObj = { index: 0 };
  const linkedImages = detectLinkedImages(doc);
  const processedBlocks = await Promise.all(
    doc.body?.content?.map(async (block) => {
      if (block.sectionBreak) {
        return { type: 'sectionBreak', content: null };
      }
      if (block.paragraph) {
        const bullet = block.paragraph.bullet;
        if (bullet) {
          return { 
            type: 'listItem', 
            content: processParagraph(block.paragraph, linkedImages),
            listId: bullet.listId,
            nestingLevel: bullet.nestingLevel || 0
          };
        }
        // Positioned objects in paragraph
        if (block.paragraph.positionedObjectIds?.length > 0) {
          const positionedElements = await Promise.all(
            block.paragraph.positionedObjectIds.map(async (positionedObjectId) => {
              return await processPositionedObject(positionedObjectId, doc.positionedObjects);
            })
          );
          const paragraphContent = processParagraph(block.paragraph, linkedImages);
          return { type: 'paragraph', content: positionedElements.join('') + paragraphContent };
        }

        // Inline objects (images) handling
        const hasInlineObjects = block.paragraph.elements?.some((el) => el.inlineObjectElement);
        if (hasInlineObjects) {
          const elements = await Promise.all(
            block.paragraph.elements?.map(async (element) => {
              if (element.inlineObjectElement) {
                const currentImageIndex = imageIndex++;
                return await processInlineObject(element.inlineObjectElement.inlineObjectId, doc.inlineObjects, currentImageIndex);
              } else {
                return processTextElement(element, linkedImages);
              }
            }) || []
          );
          return { type: 'paragraph', content: elements.join('') };
        }

        return { type: 'paragraph', content: processParagraph(block.paragraph, linkedImages) };
      }
      if (block.table) {
        return { type: 'table', content: await processTable(block.table, linkedImages, doc, imageIndexObj) };
      }
      return { type: 'empty', content: "" };
    }) || []
  );
  const html = [];
  let i = 0;
  while (i < processedBlocks.length) {
    const block = processedBlocks[i];
    if (block.type === 'listItem') {
      const listItems = [];
      while (i < processedBlocks.length && processedBlocks[i].type === 'listItem') {
        listItems.push(processedBlocks[i].content);
        i++;
      }
      html.push(`<ul class="list-disc list-inside space-y-1 mb-4 ml-4">${listItems.join('')}</ul>`);
    } else {
      html.push(block.content);
      i++;
    }
  }
  return html.join("");
}
