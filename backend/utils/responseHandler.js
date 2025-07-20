// Standard response format for API
exports.sendResponse = (res, statusCode, success, message, data = null, meta = null) => {
  const response = {
    success,
    message,
    ...(data && { data }),
    ...(meta && { meta })
  };

  res.status(statusCode).json(response);
};

// Success responses
exports.sendSuccess = (res, message, data = null, statusCode = 200, meta = null) => {
  exports.sendResponse(res, statusCode, true, message, data, meta);
};

// Error responses
exports.sendError = (res, message, statusCode = 400, data = null) => {
  exports.sendResponse(res, statusCode, false, message, data);
};

// Pagination helper
exports.getPagination = (page = 1, limit = 10, total) => {
  const currentPage = parseInt(page);
  const pageSize = parseInt(limit);
  const totalPages = Math.ceil(total / pageSize);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: total,
    hasNext,
    hasPrev,
    nextPage: hasNext ? currentPage + 1 : null,
    prevPage: hasPrev ? currentPage - 1 : null
  };
};
