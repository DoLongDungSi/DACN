-- Drop old tables if they exist to ensure clean state
DROP TABLE IF EXISTS votes, discussion_comments, discussion_posts, submissions, problem_metrics, problem_tags, problems, metrics, tags, invoices, payments, subscriptions, users CASCADE;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'creator', 'owner'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    avatar_color VARCHAR(50),
    avatar_url TEXT,
    profile JSONB,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tags and Metrics Tables
CREATE TABLE tags ( id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL );
CREATE TABLE metrics ( id SERIAL PRIMARY KEY, key VARCHAR(50) UNIQUE NOT NULL, direction VARCHAR(10) NOT NULL ); -- direction: 'maximize' or 'minimize'

-- Problems Table (Updated with new columns)
CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL, -- 'easy', 'medium', 'hard'
    content TEXT NOT NULL, -- Markdown content
    summary TEXT, -- Short description
    problem_type VARCHAR(50) NOT NULL, -- 'classification', 'regression', 'other'
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    datasets JSONB, -- Stores array of {split, filename, path, sizeBytes?} metadata
    evaluation_script TEXT, -- Stores the Python evaluation script content
    cover_image_url TEXT, -- Path or URL to cover image
    data_description TEXT, -- Description of data
    prizes TEXT, -- Prize details
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE, -- Contest status
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- Soft delete flag
    tags JSONB DEFAULT '[]'::JSONB, -- Denormalized tag names for quick access
    metrics JSONB DEFAULT '[]'::JSONB -- Denormalized metric keys for quick access
);

-- Junction Table: Problem <-> Tags
CREATE TABLE problem_tags (
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (problem_id, tag_id)
);

-- Junction Table: Problem <-> Metrics
CREATE TABLE problem_metrics (
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    metric_id INTEGER REFERENCES metrics(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE, -- To indicate the main metric for leaderboard (optional)
    PRIMARY KEY (problem_id, metric_id)
);

-- Subscriptions / Payments / Invoices
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'inactive',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renews_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(30) NOT NULL,
    provider_ref VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    invoice_number VARCHAR(64) UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    pdf_path TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions Table
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'pending', 'succeeded', 'failed', 'format_error', 'runtime_error'
    public_score NUMERIC(12, 6), -- Score based on public test, NULL if failed/pending
    private_score NUMERIC(12, 6), -- Score based on ground truth, NULL if failed/pending
    runtime_ms NUMERIC(10, 2), -- Execution time in milliseconds
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluated_at TIMESTAMPTZ,
    file_path TEXT, -- Path to submission file
    evaluation_details JSONB, -- Store potential error messages from evaluation (structured)
    is_official BOOLEAN NOT NULL DEFAULT TRUE -- Determines if submission counts for leaderboard
);

-- Discussion: Posts Table
CREATE TABLE discussion_posts (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Discussion: Comments Table
CREATE TABLE discussion_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES discussion_posts(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES discussion_comments(id) ON DELETE CASCADE, -- For nested comments
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes Table (for both Posts and Comments)
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES discussion_posts(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES discussion_comments(id) ON DELETE CASCADE,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)), -- -1 for downvote, 1 for upvote
    -- Ensure a user can only vote once per post OR per comment
    CONSTRAINT user_vote_unique UNIQUE (user_id, post_id, comment_id),
    -- Ensure a vote is linked to either a post OR a comment, not both or neither
    CONSTRAINT check_vote_target CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL))
);


-- INITIAL DATA --

-- Sample User (Owner)
INSERT INTO users (id, username, email, password_hash, role, avatar_color, profile, is_premium) VALUES
(1, 'admin', 'admin@mljudge.com', '$2b$10$WLijFpXO4G5XS9M7olwHnOsi8DQ0ofknVXYQCfSBIYuU21bSOofs6', 'owner', 'bg-red-600', '{"realName": "Admin", "skills": [], "education": [], "workExperience": [], "allowJobContact": true, "showOnLeaderboard": true, "showSubmissionHistory": true}', TRUE);

-- Sample Tags
INSERT INTO tags (id, name) VALUES (1, 'classification'), (2, 'regression'), (3, 'tabular'), (4, 'baseline'), (5, 'getting-started');
-- Sample Metrics
INSERT INTO metrics (id, key, direction) VALUES (1, 'accuracy', 'maximize'), (2, 'rmse', 'minimize');

-- Update sequences to avoid ID conflicts
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('problems', 'id'), COALESCE((SELECT MAX(id) FROM problems), 1));
SELECT setval(pg_get_serial_sequence('tags', 'id'), COALESCE((SELECT MAX(id) FROM tags), 1));
SELECT setval(pg_get_serial_sequence('metrics', 'id'), COALESCE((SELECT MAX(id) FROM metrics), 1));
SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 1));
SELECT setval(pg_get_serial_sequence('discussion_posts', 'id'), COALESCE((SELECT MAX(id) FROM discussion_posts), 1));
SELECT setval(pg_get_serial_sequence('discussion_comments', 'id'), COALESCE((SELECT MAX(id) FROM discussion_comments), 1));
SELECT setval(pg_get_serial_sequence('votes', 'id'), COALESCE((SELECT MAX(id) FROM votes), 1));
SELECT setval(pg_get_serial_sequence('subscriptions', 'id'), COALESCE((SELECT MAX(id) FROM subscriptions), 1));
SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1));
SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE((SELECT MAX(id) FROM invoices), 1));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_problems_timestamp
BEFORE UPDATE ON problems
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Create trigger to cleanup files when problem is deleted
CREATE OR REPLACE FUNCTION cleanup_problem_files()
RETURNS TRIGGER AS $$
DECLARE
    dataset RECORD;
    file_path TEXT;
BEGIN
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
        -- Delete all submission files first
        PERFORM pg_notify('cleanup_files',
            json_build_object(
                'type', 'submissions',
                'problem_id', NEW.id
            )::text
        );
        
        -- Delete problem files
        FOR dataset IN SELECT * FROM jsonb_array_elements(NEW.datasets)
        LOOP
            file_path := dataset->>'path';
            IF file_path IS NOT NULL THEN
                PERFORM pg_notify('cleanup_files',
                    json_build_object(
                        'type', 'problem_file',
                        'path', file_path
                    )::text
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_problem_files
AFTER UPDATE ON problems
FOR EACH ROW EXECUTE FUNCTION cleanup_problem_files();