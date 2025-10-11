const pdf = require('pdf-parse');
const fileType = require('file-type');
const xml2js = require('xml2js');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;

class MetadataExtractor {
  /**
   * Extract metadata from a file buffer
   * @param {Buffer} fileBuffer - The file buffer to analyze
   * @param {string} fileName - The name of the file
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(fileBuffer, fileName) {
    const metadata = {
      fileName: fileName,
      size: fileBuffer.length,
      detectedMimeType: null,
      extractedText: '',
      customMetadata: {}
    };

    // Detect file type
    const detectedType = await fileType.fromBuffer(fileBuffer);
    metadata.detectedMimeType = detectedType ? detectedType.mime : 'application/octet-stream';

    // Extract metadata based on file type
    const fileExt = path.extname(fileName).toLowerCase();
    
    if (fileExt === '.pdf' || metadata.detectedMimeType === 'application/pdf') {
      Object.assign(metadata, await this.extractPdfMetadata(fileBuffer));
    } else if (fileExt === '.docx' || fileExt === '.doc') {
      // For doc/docx files, we would need additional libraries
      metadata.customMetadata.officeType = fileExt.substring(1);
      metadata.customMetadata.hasText = true; // Placeholder
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      Object.assign(metadata, await this.extractExcelMetadata(fileBuffer));
    } else if (fileExt === '.xml') {
      Object.assign(metadata, await this.extractXmlMetadata(fileBuffer));
    } else if (fileExt === '.txt') {
      metadata.extractedText = fileBuffer.toString('utf-8');
    } else if (fileExt.match(/\.(jpg|jpeg|png|gif|bmp|tiff)$/)) {
      // For image files, we'd extract image-specific metadata
      metadata.customMetadata.imageType = fileExt.substring(1);
    }

    // Generate a content hash for deduplication
    const crypto = require('crypto');
    metadata.contentHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    return metadata;
  }

  /**
   * Extract metadata from PDF files
   * @param {Buffer} fileBuffer - PDF file buffer
   * @returns {Promise<Object>} PDF metadata
   */
  async extractPdfMetadata(fileBuffer) {
    try {
      const pdfData = await pdf(fileBuffer);
      
      return {
        extractedText: pdfData.text.substring(0, 1000), // Limit text extraction
        customMetadata: {
          pdfInfo: {
            numPages: pdfData.numpages,
            version: pdfData.version,
            title: pdfData.info.Title || null,
            author: pdfData.info.Author || null,
            subject: pdfData.info.Subject || null,
            keywords: pdfData.info.Keywords || null,
            creator: pdfData.info.Creator || null,
            producer: pdfData.info.Producer || null,
            creationDate: pdfData.info.CreationDate || null,
            modificationDate: pdfData.info.ModDate || null
          }
        }
      };
    } catch (error) {
      console.error('Error extracting PDF metadata:', error);
      return { extractedText: '', customMetadata: { error: 'Failed to parse PDF' } };
    }
  }

  /**
   * Extract metadata from Excel files
   * @param {Buffer} fileBuffer - Excel file buffer
   * @returns {Promise<Object>} Excel metadata
   */
  async extractExcelMetadata(fileBuffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const metadata = {
        customMetadata: {
          excelInfo: {
            sheetNames: workbook.SheetNames,
            numSheets: workbook.SheetNames.length
          }
        },
        extractedText: ''
      };

      // Extract text from all sheets
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_csv(worksheet);
        metadata.extractedText += sheetText + '\n';
      });

      // Limit the extracted text to prevent huge payloads
      metadata.extractedText = metadata.extractedText.substring(0, 1000);

      return metadata;
    } catch (error) {
      console.error('Error extracting Excel metadata:', error);
      return { extractedText: '', customMetadata: { error: 'Failed to parse Excel file' } };
    }
  }

  /**
   * Extract metadata from XML files
   * @param {Buffer} fileBuffer - XML file buffer
   * @returns {Promise<Object>} XML metadata
   */
  async extractXmlMetadata(fileBuffer) {
    try {
      const xmlContent = fileBuffer.toString('utf-8');
      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(xmlContent);

      return {
        extractedText: this.extractTextFromXml(parsed),
        customMetadata: {
          xmlInfo: {
            hasRoot: !!parsed && Object.keys(parsed).length > 0
          }
        }
      };
    } catch (error) {
      console.error('Error extracting XML metadata:', error);
      return { extractedText: '', customMetadata: { error: 'Failed to parse XML' } };
    }
  }

  /**
   * Extract plain text from parsed XML object
   * @param {Object} obj - Parsed XML object
   * @param {string} text - Accumulated text
   * @returns {string} Extracted text
   */
  extractTextFromXml(obj, text = '') {
    if (typeof obj === 'string' || typeof obj === 'number') {
      return text + ' ' + String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => this.extractTextFromXml(item, acc), text);
    }

    if (typeof obj === 'object') {
      for (const key in obj) {
        if (key !== '$' && !Array.isArray(key)) { // Skip metadata fields
          text = this.extractTextFromXml(obj[key], text);
        }
      }
    }

    return text;
  }
}

module.exports = new MetadataExtractor();