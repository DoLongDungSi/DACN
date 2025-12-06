-- Drop old tables if they exist
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

-- Problems Table (stores dataset paths instead of inline CSV content)
CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL, -- 'easy', 'medium', 'hard'
    content TEXT NOT NULL, -- Markdown content
    summary TEXT,
    problem_type VARCHAR(50) NOT NULL, -- 'classification', 'regression', 'other'
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    datasets JSONB, -- Stores array of {split, filename, path, sizeBytes?} metadata
    evaluation_script TEXT, -- Stores the Python evaluation script content
    ground_truth_path TEXT, -- Path to ground truth CSV on disk
    public_test_path TEXT, -- Path to public test CSV on disk
    cover_image_url TEXT
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
    public_score NUMERIC(12, 6), -- Score based on public test/ground truth, NULL if failed/pending
    runtime_ms NUMERIC(10, 2), -- Execution time in milliseconds
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluation_details JSONB -- Store potential error messages from evaluation (structured)
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

-- Sample Problem 1: Classification
INSERT INTO problems (id, name, difficulty, content, summary, problem_type, author_id, datasets, evaluation_script, ground_truth_path, public_test_path, cover_image_url) VALUES
(1, 'Titanic - Survival Prediction', 'easy',
'### Overview
Predict passenger survival on the Titanic. Keep the submission format exactly with columns `PassengerId` and `Survived`.

### Files
- `titanic_train.csv`
- `titanic_public_test.csv`
- Submission must be CSV with `PassengerId,Survived`.

### Metric
Primary metric: Accuracy.',
'Start with a clean baseline for the classic Kaggle Titanic challenge.',
'classification', 1,
E''[
  {"split":"train","filename":"titanic_train.csv","path":"problems/titanic/train.csv"},
  {"split":"public_test","filename":"titanic_public_test.csv","path":"problems/titanic/public_test.csv"},
  {"split":"ground_truth","filename":"titanic_ground_truth.csv","path":"problems/titanic/ground_truth.csv"}
]'',
$$
import sys
import pandas as pd
from sklearn.metrics import accuracy_score

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    try:
        sub_df = pd.read_csv(submission_path)
        gt_df = pd.read_csv(ground_truth_path)
        test_df = pd.read_csv(public_test_path)
    except Exception as exc:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("-1.0")
        sys.exit(1)

    required_cols = {"PassengerId", "Survived"}
    if not required_cols.issubset(sub_df.columns) or len(sub_df) != len(test_df):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("-1.0")
        sys.exit(1)

    merged = pd.merge(sub_df, gt_df, on="PassengerId", how="inner")
    if len(merged) != len(sub_df):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("0.0")
        sys.exit(1)

    score = accuracy_score(merged["Survived_y"], merged["Survived_x"].round().astype(int))
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(str(float(score)))

if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(1)
    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
$$,
'problems/titanic/ground_truth.csv',
'problems/titanic/public_test.csv',
'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80&auto=format&fit=crop');

-- Sample Problem 2: Regression
INSERT INTO problems (id, name, difficulty, content, summary, problem_type, author_id, datasets, evaluation_script, ground_truth_path, public_test_path, cover_image_url) VALUES
(2, 'House Prices - Baseline Regression', 'medium',
'### Overview
Predict house sale prices. Submission must contain `Id,SalePrice`.

### Files
- `housing_train.csv`
- `housing_public_test.csv`

### Metric
Primary metric: RMSE (lower is better).',
'Simple baseline for tabular regression.',
'regression', 1,
E''[
  {"split":"train","filename":"housing_train.csv","path":"problems/housing/train.csv"},
  {"split":"public_test","filename":"housing_public_test.csv","path":"problems/housing/public_test.csv"},
  {"split":"ground_truth","filename":"housing_ground_truth.csv","path":"problems/housing/ground_truth.csv"}
]'',
$$
import sys
import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    try:
        sub_df = pd.read_csv(submission_path)
        gt_df = pd.read_csv(ground_truth_path)
        test_df = pd.read_csv(public_test_path)
    except Exception:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("-1.0")
        sys.exit(1)

    required_cols = {"Id", "SalePrice"}
    if not required_cols.issubset(sub_df.columns) or len(sub_df) != len(test_df):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("-1.0")
        sys.exit(1)

    merged = pd.merge(sub_df, gt_df, on="Id", how="inner")
    if len(merged) != len(sub_df):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("0.0")
        sys.exit(1)

    rmse = mean_squared_error(merged["SalePrice_y"], merged["SalePrice_x"], squared=False)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(str(float(rmse)))

if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(1)
    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
$$,
'problems/housing/ground_truth.csv',
'problems/housing/public_test.csv',
'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80&auto=format&fit=crop');

-- Link Problems to Tags/Metrics
INSERT INTO problem_tags (problem_id, tag_id) VALUES (1, 1), (1, 3), (1, 5), (2, 2), (2, 3), (2, 4);
INSERT INTO problem_metrics (problem_id, metric_id, is_primary) VALUES (1, 1, TRUE), (2, 2, TRUE);

-- Sample Discussion
INSERT INTO discussion_posts (id, problem_id, user_id, title, content) VALUES
(1, 1, 1, 'Baseline model for Titanic', 'Try a simple logistic regression with Cabin deck simplified to first letter.'),
(2, 2, 1, 'Feature ideas for price', 'Log-transform SalePrice and add LotArea bins for a quick RMSE win.');

INSERT INTO discussion_comments (id, post_id, parent_id, user_id, content) VALUES
(1, 1, NULL, 1, 'Standardize numeric columns and you can beat the baseline quickly.'),
(2, 2, NULL, 1, 'Remember to keep Id ordering identical to public test.');

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
