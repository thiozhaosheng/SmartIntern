function isAllowedResumeType(mimetype) {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  return allowedTypes.includes(mimetype);
}

module.exports = { isAllowedResumeType };
