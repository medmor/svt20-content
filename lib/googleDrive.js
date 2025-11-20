import { getDocsClient, getDriveClient } from "./googleAuth.js";
import { parseDoc } from "./parseDoc.js";
import { googleDocsExams } from "../data_samples/ExamData.js";

export async function listDocsInFolder(folderId) {
  const drive = await getDriveClient();
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: "files(id,name,thumbnailLink,createdTime,modifiedTime)",
    orderBy: "name_natural",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files || [];
}

export async function getDocHtml(docId) {
  const docs = await getDocsClient();
  const { data } = await docs.documents.get({ documentId: docId });
  const html = await parseDoc(data);
  return html;
}

// Get Google Doc thumbnail or first image
export async function getDocThumbnail(docId) {
  try {
    // First, try to get the first image from the doc content (better quality)
    const docs = await getDocsClient();
    const { data: doc } = await docs.documents.get({ documentId: docId });
    
    // Extract first image from doc
    const firstImage = extractFirstImageFromDoc(doc);
    if (firstImage) {
      return firstImage;
    }

    // Fallback to Drive thumbnail with higher resolution
    const drive = await getDriveClient();
    const { data } = await drive.files.get({
      fileId: docId,
      fields: "thumbnailLink",
      supportsAllDrives: true,
    });
    
    if (data.thumbnailLink) {
      // Increase thumbnail size from default (s220) to s800 or larger
      const highResThumbnail = data.thumbnailLink
        .replace(/=s\d+/, '=s800') // Change size parameter to 800px
        .replace(/=w\d+-h\d+/, '=w800-h600'); // Alternative format
      return proxifyIfGoogle(highResThumbnail);
    }
    
    return null;
  } catch (e) {
    console.error('Error fetching doc thumbnail:', e);
    return null;
  }
}

// Extract first image URL from parsed doc data
export function extractFirstImageFromDoc(doc) {
  try {
    // Check inline objects
    if (doc.inlineObjects) {
      const firstInlineObj = Object.values(doc.inlineObjects)[0];
      if (firstInlineObj?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri) {
        return proxifyIfGoogle(firstInlineObj.inlineObjectProperties.embeddedObject.imageProperties.contentUri);
      }
    }
    
    // Check positioned objects
    if (doc.positionedObjects) {
      const firstPosObj = Object.values(doc.positionedObjects)[0];
      if (firstPosObj?.positionedObjectProperties?.embeddedObject?.imageProperties?.contentUri) {
        return proxifyIfGoogle(firstPosObj.positionedObjectProperties.embeddedObject.imageProperties.contentUri);
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

export async function fetchDriveExamCards() {
  const cards = [];
  for (const cfg of googleDocsExams || []) {
    let thumb = null;
    try {
      const files = await listDocsInFolder(cfg.id);
      thumb = files?.[0]?.thumbnailLink || null;
    } catch (e) {
      // Swallow errors to still surface the card with a placeholder image
      thumb = null;
    }

    const placeholder = "/hero.jpg"; // fallback when no image provided and no thumbnail available
    const rawImage = (cfg.image && cfg.image !== "image_url") ? cfg.image : (thumb || placeholder);
    const image = proxifyIfGoogle(rawImage);

    cards.push({
      id: `gdoc_${cfg.id}`,
      session: cfg.session,
      date: cfg.date,
      duration: cfg.duration,
      branch: cfg.branch,
      image,
      _source: "gdoc",
    });
  }
  return cards;
}

function proxifyIfGoogle(url) {
  if (!url) return url;
  const lower = url.toLowerCase();
  const isGoogle = lower.includes('googleusercontent.com') || lower.includes('drive.google.com');
  if (isGoogle && !lower.startsWith('/api/image-proxy')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export async function fetchDriveExamDetail(folderId) {
  const files = await listDocsInFolder(folderId);
  const docs = [];

  for (const f of files) {
    const html = await getDocHtml(f.id);
    docs.push({ id: f.id, name: f.name, thumbnail: f.thumbnailLink || null, html });
  }

  return { folderId, docs };
}

// Fetch exercises from a Google Drive folder
export async function fetchDriveExercises(folderId) {
  if (!folderId) return [];
  
  try {
    const files = await listDocsInFolder(folderId);
    
    // Convert files to exercise card format
    const exercises = files.map((file, index) => ({
      id: file.id,
      title: file.name,
      thumbnail: file.thumbnailLink || null,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      _source: 'google_drive',
      order_index: index
    }));
    
    return exercises;
  } catch (error) {
    console.error('Error fetching Drive exercises:', error);
    return [];
  }
}

// Fetch a single exercise doc and parse it into sections
export async function fetchDriveExerciseDetail(docId) {
  try {
    const docs = await getDocsClient();
    const { data: doc } = await docs.documents.get({ documentId: docId });
    
    // Parse the full HTML
    const fullHtml = await parseDoc(doc);
    
    // Split into Exercice and Correction sections
    // Look for headings that contain "Exercice" and "Correction"
    const sections = splitExerciseDoc(fullHtml);
    
    return {
      id: docId,
      title: doc.title,
      enonceHtml: sections.exercice || '',
      correctionHtml: sections.correction || '',
      fullHtml
    };
  } catch (error) {
    console.error('Error fetching Drive exercise detail:', error);
    return null;
  }
}

// Helper function to split exercise document by headings
function splitExerciseDoc(html) {
  const sections = {
    exercice: '',
    correction: ''
  };
  
  // Find the "Correction" heading by searching for the word itself
  // Then find the complete heading tag around it
  const correctionWordIndex = html.search(/Correction/i);
  
  if (correctionWordIndex !== -1) {
    // Find the heading tag that contains "Correction"
    // Search backwards for <h tag
    let headingStart = html.lastIndexOf('<h', correctionWordIndex);
    // Search forwards for closing </h tag
    let headingEnd = html.indexOf('</h', correctionWordIndex) + 5; // +5 for </h2> or </h3>
    
    // Find the "Exercice" heading to remove it from the beginning
    const exerciceWordIndex = html.search(/Exercice/i);
    let exerciceHeadingEnd = 0;
    
    if (exerciceWordIndex !== -1 && exerciceWordIndex < headingStart) {
      // Find the end of the Exercice heading tag
      exerciceHeadingEnd = html.indexOf('</h', exerciceWordIndex) + 5; // +5 for </h2> or </h3>
    }
    
    // Split content:
    // Énoncé: from after the "Exercice" heading to start of "Correction" heading
    sections.exercice = html.substring(exerciceHeadingEnd, headingStart).trim();
    // Correction: from after the "Correction" heading to end
    sections.correction = html.substring(headingEnd).trim();
  } else {
    // If no Correction heading found, remove Exercice heading if present
    const exerciceWordIndex = html.search(/Exercice/i);
    
    if (exerciceWordIndex !== -1) {
      const exerciceHeadingEnd = html.indexOf('</h', exerciceWordIndex) + 5;
      sections.exercice = html.substring(exerciceHeadingEnd).trim();
    } else {
      sections.exercice = html;
    }
  }
  
  return sections;
}