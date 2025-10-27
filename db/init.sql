-- Drop đống bảng cũ
DROP TABLE IF EXISTS votes, discussion_comments, discussion_posts, submissions, problem_metrics, problem_tags, problems, metrics, tags, users CASCADE;

-- Bảng Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    avatar_color VARCHAR(50),
    avatar_url TEXT,
    profile JSONB,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE
);

-- Bảng Tags và Metrics
CREATE TABLE tags ( id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL );
CREATE TABLE metrics ( id SERIAL PRIMARY KEY, key VARCHAR(50) UNIQUE NOT NULL, direction VARCHAR(10) NOT NULL );

-- Bảng Problems
CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    problem_type VARCHAR(50) NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    datasets JSONB
);

-- Bảng trung gian
CREATE TABLE problem_tags ( problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE, tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (problem_id, tag_id) );
CREATE TABLE problem_metrics ( problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE, metric_id INTEGER REFERENCES metrics(id) ON DELETE CASCADE, PRIMARY KEY (problem_id, metric_id) );

-- Bảng Submissions
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    public_score NUMERIC(12, 6) NOT NULL,
    runtime_ms NUMERIC(10, 2),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng thảo luận
CREATE TABLE discussion_posts ( id SERIAL PRIMARY KEY, problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, content TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );
CREATE TABLE discussion_comments ( id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES discussion_posts(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES discussion_comments(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, content TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );

-- Bảng Votes
CREATE TABLE votes ( id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id INTEGER REFERENCES discussion_posts(id) ON DELETE CASCADE, comment_id INTEGER REFERENCES discussion_comments(id) ON DELETE CASCADE, vote_type INTEGER NOT NULL, CONSTRAINT user_vote_unique UNIQUE (user_id, post_id, comment_id) );

-- DỮ LIỆU KHỞI TẠO --
INSERT INTO users (id, username, email, password_hash, role, avatar_color, profile) VALUES
(1, 'admin', 'admin@mljudge.com', '$2b$10$WLijFpXO4G5XS9M7olwHnOsi8DQ0ofknVXYQCfSBIYuU21bSOofs6', 'owner', 'bg-red-600', '{"realName": "Admin Viète", "skills": [], "education": [], "workExperience": [], "allowJobContact": true, "showOnLeaderboard": true, "showSubmissionHistory": true, "notifications": {"award": {"site": true, "email": true}, "promotions": {"site": false, "email": false}, "newComments": {"site": true, "email": false}, "announcements": {"site": true, "email": true}, "contestUpdates": {"site": true, "email": true}, "featureAnnouncements": {"site": true, "email": true}}}');

INSERT INTO tags (id, name) VALUES (1, 'classification'), (2, 'regression'), (3, 'health'), (4, 'real-estate');
INSERT INTO metrics (id, key, direction) VALUES (1, 'accuracy', 'maximize'), (2, 'rmse', 'minimize');

INSERT INTO problems (id, name, difficulty, content, problem_type, author_id, datasets) VALUES
(1, 'Binary Classification Challenge', 'easy', '<h2>Mô tả bài toán</h2><p>Đây là một bài toán phân loại nhị phân cổ điển...</p>', 'classification', 1, '[{"split": "train", "filename": "diabetes_train.csv", "content": "col1,label\n1,0"}, {"split": "public_test", "filename": "diabetes_test.csv", "content": "col1\n2"}]'),
(2, 'House Price Regression', 'medium', '<h2>Mô tả bài toán</h2><p>Trong thử thách này, bạn sẽ dự đoán giá nhà...</p>', 'regression', 1, '[{"split": "train", "filename": "house_train.csv", "content": "col1,price\n100,150000"}, {"split": "public_test", "filename": "house_test.csv", "content": "col1\n110"}]');

INSERT INTO problem_tags (problem_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (2, 4);
INSERT INTO problem_metrics (problem_id, metric_id) VALUES (1, 1), (2, 2);

INSERT INTO discussion_posts (id, problem_id, user_id, title, content) VALUES
(1, 1, 1, 'My approach using Logistic Regression', 'I got a score of 0.85 using a simple Logistic Regression model...');

INSERT INTO discussion_comments (id, post_id, parent_id, user_id, content) VALUES
(1, 1, NULL, 1, 'Great starting point!');

-- Cập nhật lại các sequence
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('problems', 'id'), COALESCE((SELECT MAX(id) FROM problems), 1));
SELECT setval(pg_get_serial_sequence('tags', 'id'), COALESCE((SELECT MAX(id) FROM tags), 1));
SELECT setval(pg_get_serial_sequence('metrics', 'id'), COALESCE((SELECT MAX(id) FROM metrics), 1));
SELECT setval(pg_get_serial_sequence('discussion_posts', 'id'), COALESCE((SELECT MAX(id) FROM discussion_posts), 1));
SELECT setval(pg_get_serial_sequence('discussion_comments', 'id'), COALESCE((SELECT MAX(id) FROM discussion_comments), 1));

