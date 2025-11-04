import Tesseract from "tesseract.js";
import sharp from "sharp";

export interface AgeValidationResult {
  isValid: boolean;
  age?: number;
  dateOfBirth?: Date;
  error?: string;
  extractedText?: string;
}

export class OCRService {
  private readonly MIN_AGE = 18; // Minimum age requirement for parents
  private readonly MIN_IMAGE_WIDTH = 300; // Minimum width for OCR (pixels)
  private readonly MIN_IMAGE_HEIGHT = 300; // Minimum height for OCR (pixels)
  private readonly MAX_IMAGE_DIMENSION = 2000; // Max dimension to prevent huge images

  /**
   * Preprocess and enhance image for better OCR accuracy
   * Includes: resizing, contrast enhancement, noise reduction, sharpening
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      console.log(
        `[OCR Preprocess] Starting image preprocessing and enhancement...`
      );
      console.log(
        `[OCR Preprocess] Input buffer size: ${imageBuffer.length} bytes`
      );

      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const format = metadata.format;
      const channels = metadata.channels;
      const hasAlpha = metadata.hasAlpha;

      console.log(`[OCR Preprocess] Original dimensions: ${width}x${height}`);
      console.log(
        `[OCR Preprocess] Format: ${format}, Channels: ${channels}, Alpha: ${hasAlpha}`
      );

      let processed = image;

      // Step 1: Resize if needed
      if (width < this.MIN_IMAGE_WIDTH || height < this.MIN_IMAGE_HEIGHT) {
        const scaleX = this.MIN_IMAGE_WIDTH / width;
        const scaleY = this.MIN_IMAGE_HEIGHT / height;
        const scale = Math.max(scaleX, scaleY, 2);

        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        console.log(
          `[OCR Preprocess] ⚠️ Image too small! Scaling up ${scale.toFixed(
            2
          )}x to ${newWidth}x${newHeight}`
        );

        processed = processed.resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3,
        });
      } else if (
        width > this.MAX_IMAGE_DIMENSION ||
        height > this.MAX_IMAGE_DIMENSION
      ) {
        console.log(
          `[OCR Preprocess] ⚠️ Image too large! Scaling down to max ${this.MAX_IMAGE_DIMENSION}px`
        );
        processed = processed.resize(
          this.MAX_IMAGE_DIMENSION,
          this.MAX_IMAGE_DIMENSION,
          {
            fit: "inside",
            withoutEnlargement: true,
          }
        );
      }

      // Step 2: Convert to grayscale (better for text recognition)
      console.log(`[OCR Preprocess] Converting to grayscale...`);
      processed = processed.greyscale();

      // Step 3: Enhance contrast (makes text more distinct from background)
      console.log(`[OCR Preprocess] Enhancing contrast...`);
      processed = processed.modulate({
        brightness: 1.1, // Slightly brighter
        saturation: 0, // Grayscale (already applied)
        hue: 0,
      });

      // Step 4: Apply normalization (adjusts brightness/contrast automatically)
      console.log(`[OCR Preprocess] Normalizing brightness/contrast...`);
      processed = processed.normalise();

      // Step 5: Sharpen (enhances text edges)
      console.log(`[OCR Preprocess] Applying sharpening...`);
      processed = processed.sharpen(1.5, 1.0, 2.0); // sigma, flat, jagged

      // Step 6: Apply threshold for better text/background separation (optional binarization-like effect)
      // We'll use a high contrast approach instead of full threshold
      console.log(`[OCR Preprocess] Applying contrast enhancement...`);
      processed = processed.linear(1.2, -(128 * 0.2)); // Increase contrast

      // Step 7: Convert to high-quality JPEG for OCR
      const processedBuffer = await processed
        .jpeg({ quality: 100, mozjpeg: true }) // Maximum quality
        .toBuffer();

      console.log(
        `[OCR Preprocess] ✅ Enhanced image size: ${processedBuffer.length} bytes`
      );
      console.log(`[OCR Preprocess] ✅ Image enhancement complete`);
      return processedBuffer;
    } catch (error: any) {
      console.error("[OCR Preprocess] ❌ Image preprocessing failed:", error);
      console.error("[OCR Preprocess] Error name:", error.name);
      console.error("[OCR Preprocess] Error message:", error.message);
      console.error("[OCR Preprocess] Error stack:", error.stack);
      console.warn("[OCR Preprocess] Falling back to original image buffer");
      return imageBuffer;
    }
  }

  /**
   * Extract date of birth from ID image and validate age
   * Supports both English and Arabic text
   */
  async validateAgeFromID(
    file: Express.Multer.File
  ): Promise<AgeValidationResult> {
    try {
      console.log(
        `[OCR] Starting image processing for file: ${
          file.originalname || "unknown"
        }`
      );
      console.log(`[OCR] Original file size: ${file.size} bytes`);
      console.log(`[OCR] Original MIME type: ${file.mimetype}`);

      // Validate original image buffer
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error("Image buffer is empty or invalid");
      }
      console.log(
        `[OCR] Original image buffer validated: ${file.buffer.length} bytes`
      );

      // Preprocess image for better OCR accuracy
      console.log(`[OCR] Preprocessing image...`);
      const processedImage = await this.preprocessImage(file.buffer);
      console.log(`[OCR] Processed image size: ${processedImage.length} bytes`);

      // Validate processed image is valid JPEG/PNG
      if (processedImage.length < 100) {
        console.warn(
          `[OCR] ⚠️ Processed image seems too small (${processedImage.length} bytes), using original`
        );
        // Use original if processed is suspiciously small
      }

      // Validate processed image
      if (!processedImage || processedImage.length === 0) {
        throw new Error("Processed image buffer is empty or invalid");
      }
      console.log(
        `[OCR] Processed image validated: ${processedImage.length} bytes`
      );

      // Try OCR with both English and Arabic languages
      // Tesseract supports multiple languages: "eng+ara" for both
      console.log(`[OCR] Starting Tesseract OCR recognition...`);
      console.log(`[OCR] Language: eng+ara`);

      // Add timeout wrapper for OCR (30 seconds max)
      const OCR_TIMEOUT = 30000;
      let ocrResolve: (value: any) => void;
      let ocrReject: (error: any) => void;

      const ocrPromise = new Promise<any>((resolve, reject) => {
        ocrResolve = resolve;
        ocrReject = reject;
      });

      const timeoutId = setTimeout(() => {
        console.error(`[OCR] ❌ OCR timeout after ${OCR_TIMEOUT}ms`);
        ocrReject(new Error("OCR processing timed out after 30 seconds"));
      }, OCR_TIMEOUT);

      let lastProgress = -1;
      let ocrStartTime = Date.now();

      Tesseract.recognize(processedImage, "eng+ara", {
        logger: (info) => {
          // Log all OCR status updates
          if (info.status === "recognizing text") {
            const progressPercent = Math.round(info.progress * 100);
            // Only log every 5% to reduce spam, or if it's been 2+ seconds since last log
            const elapsed = (Date.now() - ocrStartTime) / 1000;
            const shouldLog =
              (progressPercent !== lastProgress && progressPercent % 5 === 0) ||
              (progressPercent !== lastProgress && elapsed >= 2);

            if (shouldLog) {
              console.log(
                `[OCR] Progress: ${progressPercent}% (${elapsed.toFixed(
                  1
                )}s elapsed)`
              );
              lastProgress = progressPercent;
            }
          }

          // Log all warnings and errors - don't suppress anything
          if (info.status === "warning") {
            const message = (info as any).message || String(info);
            console.warn(`[OCR] ⚠️ Warning:`, message);
          }

          if (info.status === "error") {
            const message = (info as any).message || String(info);
            console.error(`[OCR] ❌ Error:`, message);
          }

          // Log other statuses
          if (
            info.status !== "recognizing text" &&
            info.status !== "warning" &&
            info.status !== "error"
          ) {
            console.log(
              `[OCR] Status: ${info.status}`,
              JSON.stringify(info, null, 2)
            );
          }
        },
      })
        .then((result) => {
          clearTimeout(timeoutId);
          const elapsed = ((Date.now() - ocrStartTime) / 1000).toFixed(1);
          console.log(`[OCR] ✅ OCR completed in ${elapsed}s`);
          ocrResolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          const elapsed = ((Date.now() - ocrStartTime) / 1000).toFixed(1);
          console.error(`[OCR] ❌ OCR failed after ${elapsed}s:`, error);
          ocrReject(error);
        });

      const result = await ocrPromise;
      const { data } = result;

      const totalElapsed = ((Date.now() - ocrStartTime) / 1000).toFixed(1);
      console.log(
        `[OCR] ✅ OCR recognition completed successfully in ${totalElapsed}s`
      );

      const extractedText = data?.text || "";
      console.log(
        `[OCR] Extracted text length: ${extractedText.length} characters`
      );

      if (extractedText.length === 0) {
        console.error(`[OCR] ❌ No text extracted from image!`);
        console.error(`[OCR] Data object:`, JSON.stringify(data, null, 2));
        return {
          isValid: false,
          error:
            "Could not extract any text from ID image. Please ensure the image is clear and readable.",
          extractedText: "",
        };
      }

      console.log(
        `[OCR] First 500 chars of extracted text:`,
        extractedText.substring(0, 500)
      );

      // Extract date of birth from the text
      console.log(`[OCR] Attempting to extract date of birth from text...`);
      const dateOfBirth = this.extractDateOfBirth(extractedText);

      if (!dateOfBirth) {
        console.error(
          `[OCR] Failed to extract date of birth from extracted text`
        );
        console.error(`[OCR] Full extracted text:`, extractedText);
        return {
          isValid: false,
          error:
            "Could not extract date of birth from ID image. Please ensure the image is clear and the date of birth is visible.",
          extractedText: extractedText.substring(0, 500), // First 500 chars for debugging
        };
      }

      console.log(`[OCR] Extracted date of birth:`, dateOfBirth);

      // Calculate age
      const age = this.calculateAge(dateOfBirth);

      // Validate minimum age
      if (age < this.MIN_AGE) {
        return {
          isValid: false,
          age,
          dateOfBirth,
          error: `Minimum age requirement is ${this.MIN_AGE} years. You are ${age} years old.`,
          extractedText: extractedText.substring(0, 200),
        };
      }

      return {
        isValid: true,
        age,
        dateOfBirth,
        extractedText: extractedText.substring(0, 200),
      };
    } catch (error: any) {
      console.error("[OCR] Error processing ID image:", error);
      console.error("[OCR] Error name:", error.name);
      console.error("[OCR] Error message:", error.message);
      console.error("[OCR] Error stack:", error.stack);

      return {
        isValid: false,
        error: `Failed to process ID image: ${
          error.message || "Unknown error"
        }. Please ensure the image is a valid image file and try again.`,
        extractedText: undefined,
      };
    }
  }

  /**
   * Extract date of birth from OCR text
   * Handles various formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
   * Supports both English and Arabic text (Arabic numerals are typically converted to Western by OCR)
   */
  private extractDateOfBirth(text: string): Date | null {
    console.log(`[OCR Date Extraction] Starting date extraction from text...`);
    console.log(`[OCR Date Extraction] Text length: ${text.length} characters`);

    // Normalize Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Western numerals (0-9)
    const normalizedText = text
      .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (char) => {
        const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
        const index = arabicNumerals.indexOf(char);
        return index >= 0 ? index.toString() : char;
      })
      .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (char) => {
        const persianNumerals = "۰۱۲۳۴۵۶۷۸۹";
        const index = persianNumerals.indexOf(char);
        return index >= 0 ? index.toString() : char;
      });

    // Primary Arabic keyword: "تاريخ الولادة" (date of birth)
    const primaryKeyword = "تاريخ الولادة";
    const keywordVariations = [
      primaryKeyword,
      "تاريخ الرلادق", // OCR corruption: ق instead of و
      "تاريخ الرلادة", // OCR corruption
      "تاريخ الولاده", // OCR corruption: ه instead of ة
      "تاريخ الولاد", // OCR corruption: missing ة
    ];

    // Find the DOB keyword first (targeted approach)
    let keywordIndex = -1;

    for (const keyword of keywordVariations) {
      keywordIndex = text.indexOf(keyword);
      if (keywordIndex === -1) {
        keywordIndex = normalizedText.indexOf(keyword);
      }
      if (keywordIndex !== -1) {
        console.log(
          `[OCR Date Extraction] Found DOB keyword "${keyword}" at index ${keywordIndex}`
        );
        break;
      }
    }

    // If keyword not found, try English keywords
    if (keywordIndex === -1) {
      const englishKeywords = ["date of birth", "dob", "birth date", "born"];
      for (const keyword of englishKeywords) {
        keywordIndex = normalizedText
          .toLowerCase()
          .indexOf(keyword.toLowerCase());
        if (keywordIndex !== -1) {
          console.log(
            `[OCR Date Extraction] Found DOB keyword "${keyword}" at index ${keywordIndex}`
          );
          break;
        }
      }
    }

    if (keywordIndex === -1) {
      console.warn(
        `[OCR Date Extraction] No DOB keyword found, searching entire text`
      );
      // Fallback: search entire text but still targeted
      return this.extractDateFromText(normalizedText, 0, normalizedText.length);
    }

    // Extract date from the vicinity of the keyword (within 100 characters after)
    const searchStart = keywordIndex;
    const searchEnd = Math.min(keywordIndex + 150, normalizedText.length);
    const searchWindow = normalizedText.substring(searchStart, searchEnd);

    console.log(
      `[OCR Date Extraction] Searching for date near keyword (${searchStart} to ${searchEnd})`
    );
    console.log(
      `[OCR Date Extraction] Search window: "${searchWindow.substring(0, 100)}"`
    );

    return this.extractDateFromText(normalizedText, searchStart, searchEnd);
  }

  /**
   * Extract date from a specific text region
   * Uses DD/MM/YYYY format (standard for Arabic IDs)
   */
  private extractDateFromText(
    text: string,
    startIndex: number,
    endIndex: number
  ): Date | null {
    const searchWindow = text.substring(startIndex, endIndex);

    // Pattern 1: Full date DD/MM/YYYY or DD-MM-YYYY (most common for Arabic IDs)
    const fullDatePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;

    // Pattern 2: Partial date DD/MM/ (year might be separated or missing)
    const partialDatePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-]/g;

    let match;
    const dates: Date[] = [];

    // First, try full date pattern (DD/MM/YYYY)
    while ((match = fullDatePattern.exec(searchWindow)) !== null) {
      try {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);

        console.log(
          `[OCR Date Extraction] Found full date pattern: ${day}/${month}/${year}`
        );

        if (this.validateAndAddDate(day, month, year, dates)) {
          continue; // Date was added
        }
      } catch (e) {
        console.log(
          `[OCR Date Extraction] Error parsing full date: ${match[0]}`
        );
      }
    }

    // If no full dates found, try partial pattern (DD/MM/) and search for year nearby
    if (dates.length === 0) {
      console.log(
        `[OCR Date Extraction] No full dates found, trying partial date pattern...`
      );
      partialDatePattern.lastIndex = 0;

      while ((match = partialDatePattern.exec(searchWindow)) !== null) {
        try {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          const matchEndIndex = match.index + match[0].length;

          console.log(
            `[OCR Date Extraction] Found partial date: ${day}/${month}/ at index ${match.index}`
          );

          // Search for 4-digit year within 50 characters after the partial date
          const yearSearchWindow = searchWindow.substring(
            matchEndIndex,
            Math.min(matchEndIndex + 50, searchWindow.length)
          );
          const yearMatch = yearSearchWindow.match(/\b(19\d{2}|20\d{2})\b/);

          if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            console.log(
              `[OCR Date Extraction] Found year ${year} near partial date`
            );

            if (this.validateAndAddDate(day, month, year, dates)) {
              continue;
            }
          } else {
            console.log(
              `[OCR Date Extraction] No year found near partial date ${day}/${month}/`
            );
          }
        } catch (e) {
          console.log(
            `[OCR Date Extraction] Error parsing partial date: ${match[0]}`
          );
        }
      }
    }

    if (dates.length === 0) {
      console.warn(
        `[OCR Date Extraction] No valid dates found in search window`
      );
      return null;
    }

    // Return the oldest date (most likely DOB)
    if (dates.length > 0) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      console.log(
        `[OCR Date Extraction] Selected oldest date: ${dates[0].toISOString()}`
      );
      return dates[0];
    }

    return null;
  }

  /**
   * Validate date and add to dates array if valid
   */
  private validateAndAddDate(
    day: number,
    month: number,
    year: number,
    dates: Date[]
  ): boolean {
    // Validate ranges
    if (
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12 ||
      year < 1900 ||
      year > new Date().getFullYear()
    ) {
      console.log(
        `[OCR Date Extraction] Date rejected (invalid ranges): ${day}/${month}/${year}`
      );
      return false;
    }

    // Try DD/MM/YYYY format (standard for Arabic IDs)
    const date = new Date(year, month - 1, day);

    // Validate the date is valid (handles invalid dates like 31/02/2000)
    if (
      !isNaN(date.getTime()) &&
      date.getDate() === day &&
      date.getMonth() === month - 1 &&
      date.getFullYear() === year
    ) {
      dates.push(date);
      console.log(`[OCR Date Extraction] ✅ Valid date: ${date.toISOString()}`);
      return true;
    } else {
      console.log(
        `[OCR Date Extraction] Date invalid (e.g., 31/02): ${day}/${month}/${year}`
      );
      return false;
    }
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }

    return age;
  }
}

export const ocrService = new OCRService();
