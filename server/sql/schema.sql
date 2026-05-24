-- Azure SQL schema for CampusCompanion

-- Users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
  CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(100) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(200) NOT NULL,
    language NVARCHAR(10) NOT NULL DEFAULT 'en'
  );
END;

-- Corpus documents (RAG training corpus stored in SQL)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'documents_corpus')
BEGIN
  CREATE TABLE documents_corpus (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(400) NOT NULL,
    source_uri NVARCHAR(1000) NULL,
    checksum NVARCHAR(64) NULL, -- e.g., MD5 of original file
    page_count INT NULL,
    ingested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_documents_corpus_checksum ON documents_corpus(checksum);
END;

-- Corpus chunks (pre-chunked text for RAG)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'corpus_chunks')
BEGIN
  CREATE TABLE corpus_chunks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    document_id INT NOT NULL,
    chunk_index INT NOT NULL,
    text NVARCHAR(MAX) NOT NULL,
    source_page INT NULL,
    source_offset INT NULL,
    checksum NVARCHAR(64) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_corpus_chunks_document FOREIGN KEY (document_id) REFERENCES documents_corpus(id)
  );
  CREATE INDEX IX_corpus_chunks_doc ON corpus_chunks(document_id, chunk_index);
END;

-- Documents
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'documents')
BEGIN
  CREATE TABLE documents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NULL,
    filename NVARCHAR(300) NOT NULL,
    file_content NVARCHAR(MAX) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    deadline DATE NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_documents_users FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IX_documents_user ON documents(user_id);
END;

-- Locations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'locations')
BEGIN
  CREATE TABLE locations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NULL,
    building NVARCHAR(50) NULL,
    floor NVARCHAR(50) NULL,
    room_number NVARCHAR(50) NULL,
    hours NVARCHAR(200) NULL,
    coordinates NVARCHAR(200) NOT NULL, -- JSON string {lat,lng}
    location_type NVARCHAR(50) NOT NULL
  );
END;

-- Messages
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'messages')
BEGIN
  CREATE TABLE messages (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    is_user_message BIT NOT NULL,
    sources NVARCHAR(MAX) NULL, -- JSON array string
    timestamp DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_messages_users FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IX_messages_user_time ON messages(user_id, timestamp);
END;

-- Notifications
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
  CREATE TABLE notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    type NVARCHAR(50) NOT NULL,
  is_read BIT NOT NULL DEFAULT 0,
    date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    related_item_id INT NULL,
    related_item_type NVARCHAR(50) NULL,
    CONSTRAINT FK_notifications_users FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IX_notifications_user_read ON notifications(user_id, is_read);
END;

-- Events
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'events')
BEGIN
  CREATE TABLE events (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    location NVARCHAR(200) NOT NULL,
    location_id INT NULL,
    datetime DATETIME2 NOT NULL,
    CONSTRAINT FK_events_locations FOREIGN KEY (location_id) REFERENCES locations(id)
  );
END;

-- Contacts
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'contacts')
BEGIN
  CREATE TABLE contacts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    department NVARCHAR(200) NOT NULL,
    role NVARCHAR(200) NOT NULL,
    email NVARCHAR(200) NOT NULL,
    phone NVARCHAR(50) NULL,
    office NVARCHAR(100) NULL,
    office_hours NVARCHAR(200) NULL,
    tags NVARCHAR(MAX) NULL, -- JSON array string
    location_id INT NULL,
    CONSTRAINT FK_contacts_locations FOREIGN KEY (location_id) REFERENCES locations(id)
  );
END;

-- Courses
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'courses')
BEGIN
  CREATE TABLE courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE,
    title NVARCHAR(200) NOT NULL,
    program NVARCHAR(100) NOT NULL,
    credits INT NOT NULL,
    semester INT NULL,
    required BIT NOT NULL DEFAULT 0,
    elective BIT NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_courses_program ON courses(program);
END;

-- Course prerequisites
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'course_prerequisites')
BEGIN
  CREATE TABLE course_prerequisites (
    id INT IDENTITY(1,1) PRIMARY KEY,
    course_id INT NOT NULL,
    prereq_course_id INT NOT NULL,
    CONSTRAINT FK_course_pr_course FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT FK_course_pr_prereq FOREIGN KEY (prereq_course_id) REFERENCES courses(id)
  );
  CREATE INDEX IX_course_pr_course ON course_prerequisites(course_id);
END;

-- User completed courses
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_completed_courses')
BEGIN
  CREATE TABLE user_completed_courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    term NVARCHAR(20) NULL,
    grade NVARCHAR(5) NULL,
    CONSTRAINT FK_ucc_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_ucc_course FOREIGN KEY (course_id) REFERENCES courses(id)
  );
  CREATE INDEX IX_ucc_user ON user_completed_courses(user_id);
END;
