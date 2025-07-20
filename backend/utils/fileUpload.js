const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('./logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && 
           process.env.CLOUDINARY_API_KEY && 
           process.env.CLOUDINARY_API_SECRET);
};

// Cloudinary storage configuration
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'marketplace',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Memory storage for development/fallback
const memoryStorage = multer.memoryStorage();

// Configure multer based on environment
const storage = isCloudinaryConfigured() ? cloudinaryStorage : memoryStorage;

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',');
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  }
});

// Upload single image
const uploadSingle = (fieldName = 'image') => {
  return upload.single(fieldName);
};

// Upload multiple images
const uploadMultiple = (fieldName = 'images', maxCount = 5) => {
  return upload.array(fieldName, maxCount);
};

// Upload fields (for different image types)
const uploadFields = (fields) => {
  return upload.fields(fields);
};

// Process uploaded file for non-Cloudinary uploads
const processFile = async (file) => {
  if (!file) return null;

  // If using Cloudinary, file.path contains the URL
  if (isCloudinaryConfigured() && file.path) {
    return {
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      size: file.size
    };
  }

  // For memory storage, convert to base64 (development only)
  if (file.buffer) {
    const base64 = file.buffer.toString('base64');
    return {
      url: `data:${file.mimetype};base64,${base64}`,
      originalName: file.originalname,
      size: file.size
    };
  }

  return null;
};

// Process multiple files
const processFiles = async (files) => {
  if (!files || !Array.isArray(files)) return [];
  
  const processedFiles = [];
  for (const file of files) {
    const processed = await processFile(file);
    if (processed) {
      processedFiles.push(processed);
    }
  }
  
  return processedFiles;
};

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
  if (!isCloudinaryConfigured() || !publicId) {
    return { success: false, message: 'Cloudinary not configured or no public ID provided' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Image deleted from Cloudinary: ${publicId}`);
    return { success: true, result };
  } catch (error) {
    logger.error('Error deleting image from Cloudinary:', error);
    return { success: false, error: error.message };
  }
};

// Delete multiple images
const deleteImages = async (publicIds) => {
  if (!Array.isArray(publicIds)) return { success: false, message: 'Public IDs must be an array' };
  
  const results = [];
  for (const publicId of publicIds) {
    const result = await deleteImage(publicId);
    results.push({ publicId, ...result });
  }
  
  return results;
};

// Generate image transformations
const generateImageUrl = (publicId, transformations = {}) => {
  if (!isCloudinaryConfigured() || !publicId) return null;
  
  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  const finalTransformations = { ...defaultTransformations, ...transformations };
  
  return cloudinary.url(publicId, finalTransformations);
};

// Generate thumbnail
const generateThumbnail = (publicId, width = 300, height = 300) => {
  return generateImageUrl(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'center'
  });
};

// Middleware to handle upload errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  processFile,
  processFiles,
  deleteImage,
  deleteImages,
  generateImageUrl,
  generateThumbnail,
  handleUploadError,
  isCloudinaryConfigured
};
