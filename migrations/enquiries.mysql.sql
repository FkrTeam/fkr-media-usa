-- Project enquiries submitted through the contact form (worker/index.js).
--
-- The Worker runs this same statement itself on first use, so importing it
-- by hand (phpMyAdmin → SQL) is optional. It is here so the schema can be
-- read without opening the code.
--
-- service and budget hold the LABELS the visitor saw ("Digital
-- Advertising", "Under $25,000"), not the ids the <select> submitted.
-- ip_hash is a salted SHA-256 of the visitor's address, kept only to count
-- repeats for the rate limit. The address itself is never stored.
-- notified_at is set once the notification email was accepted by the SMTP
-- server, and notify_status says how it went either way: "No problem", or
-- the server's own refusal. A row with no notified_at and a notify_status
-- is an enquiry FKR has not been told about — the ones to follow up.

CREATE TABLE IF NOT EXISTS enquiries (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  received_at   DATETIME(3)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  company       VARCHAR(160) NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(40)  NULL,
  service       VARCHAR(80)  NOT NULL,
  budget        VARCHAR(80)  NULL,
  message       TEXT         NOT NULL,
  ip_hash       CHAR(64)     NOT NULL,
  user_agent    VARCHAR(300) NULL,
  referer       VARCHAR(500) NULL,
  notified_at   DATETIME(3)  NULL,
  notify_status VARCHAR(200) NULL,
  INDEX enquiries_received_at (received_at),
  INDEX enquiries_ip_window (ip_hash, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
