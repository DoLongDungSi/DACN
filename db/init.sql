-- Drop old tables if they exist
DROP TABLE IF EXISTS votes, discussion_comments, discussion_posts, submissions, problem_metrics, problem_tags, problems, metrics, tags, users CASCADE;

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
    is_banned BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tags and Metrics Tables
CREATE TABLE tags ( id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL );
CREATE TABLE metrics ( id SERIAL PRIMARY KEY, key VARCHAR(50) UNIQUE NOT NULL, direction VARCHAR(10) NOT NULL ); -- direction: 'maximize' or 'minimize'

-- Problems Table (MODIFIED: Added public_test_content)
CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL, -- 'easy', 'medium', 'hard'
    content TEXT NOT NULL, -- Markdown content
    problem_type VARCHAR(50) NOT NULL, -- 'classification', 'regression', 'other'
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    datasets JSONB, -- Stores array of {split: 'train'/'public_test', filename: '...'} metadata
    evaluation_script TEXT, -- Stores the Python evaluation script content
    ground_truth_content TEXT, -- Stores the content of the ground truth CSV file
    public_test_content TEXT -- NEW COLUMN: Stores the content of the public test CSV file
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

-- Submissions Table (MODIFIED: status type changed to VARCHAR for more flexibility)
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
INSERT INTO users (id, username, email, password_hash, role, avatar_color, profile) VALUES
(1, 'admin', 'admin@mljudge.com', '$2b$10$WLijFpXO4G5XS9M7olwHnOsi8DQ0ofknVXYQCfSBIYuU21bSOofs6', 'owner', 'bg-red-600', '{"realName": "Admin Viète", "skills": [], "education": [], "workExperience": [], "allowJobContact": true, "showOnLeaderboard": true, "showSubmissionHistory": true, "notifications": {"award": {"site": true, "email": true}, "promotions": {"site": false, "email": false}, "newComments": {"site": true, "email": false}, "announcements": {"site": true, "email": true}, "contestUpdates": {"site": true, "email": true}, "featureAnnouncements": {"site": true, "email": true}}}');

-- Sample Tags
INSERT INTO tags (id, name) VALUES (1, 'classification'), (2, 'regression'), (3, 'health'), (4, 'real-estate'), (5, 'tabular');
-- Sample Metrics
INSERT INTO metrics (id, key, direction) VALUES (1, 'accuracy', 'maximize'), (2, 'rmse', 'minimize');

-- Sample Problem 1: Classification (Added sample public_test_content)
INSERT INTO problems (id, name, difficulty, content, problem_type, author_id, datasets, evaluation_script, ground_truth_content, public_test_content) VALUES
(1, 'Phân loại Bệnh tiểu đường', 'easy',
'## Mô tả\n\nDự đoán xem một bệnh nhân có bị tiểu đường hay không dựa trên các chỉ số sức khỏe.\n\n## Dữ liệu\n\n* `train.csv`: Dữ liệu huấn luyện với các features và cột `Outcome` (0 hoặc 1).\n* `test.csv`: Dữ liệu kiểm tra chỉ chứa features.\n\n## Nộp bài\n\nNộp file csv có 2 cột: `id` và `prediction` (0 hoặc 1).\n\n## Đánh giá\n\nSử dụng **Accuracy**.\n',
'classification', 1,
'[{"split": "train", "filename": "diabetes_train.csv"}, {"split": "public_test", "filename": "diabetes_test.csv"}]',
'# Script chấm điểm mẫu: Accuracy
import sys, pandas as pd, traceback
from sklearn.metrics import accuracy_score

# Args: submission_path, ground_truth_path, public_test_path, output_path
# Score: -1 (lỗi format), 0 (lỗi tính điểm), >=0 (điểm thực tế)

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    required_columns = [''id'', ''prediction'']
    final_score = -1.0 # Mặc định là lỗi format
    try:
        try: sub_df = pd.read_csv(submission_path)
        except Exception as e: raise ValueError(f"Lỗi đọc submission: {e}")
        try: gt_df = pd.read_csv(ground_truth_path)
        except Exception as e: raise RuntimeError(f"Lỗi đọc ground truth: {e}")
        try: test_df = pd.read_csv(public_test_path)
        except Exception as e: raise ValueError(f"Lỗi đọc public test: {e}")
        print("Kiểm tra định dạng...")
        missing_cols = [col for col in required_columns if col not in sub_df.columns]
        if missing_cols: raise ValueError(f"Thiếu cột: {missing_cols}")
        if len(sub_df) != len(test_df): raise ValueError(f"Sai số dòng: {len(sub_df)} vs {len(test_df)}")
        if ''id'' in test_df.columns:
            if not sub_df[''id''].sort_values().reset_index(drop=True).equals(test_df[''id''].sort_values().reset_index(drop=True)): raise ValueError("Sai lệch cột ''id''")
        if sub_df.isnull().values.any(): raise ValueError("Có giá trị thiếu (NaN/Null)")
        if not pd.api.types.is_numeric_dtype(sub_df[''prediction'']): raise ValueError("Cột ''prediction'' phải là số")
        # Thêm kiểm tra giá trị prediction cho classification (0 hoặc 1)
        if not sub_df[''prediction''].isin([0, 1]).all(): raise ValueError("Cột ''prediction'' chỉ được chứa 0 hoặc 1")
        print("--- Định dạng OK ---")
        print("Tính điểm...")
        final_score = 0.0 # Mặc định 0 nếu lỗi tính điểm
        if ''id'' not in gt_df.columns or ''Outcome'' not in gt_df.columns: raise ValueError("Ground truth thiếu cột ''id'' hoặc ''Outcome''")
        merged_df = pd.merge(sub_df[[''id'', ''prediction'']], gt_df[[''id'', ''Outcome'']], on=''id'', how=''inner'')
        if len(merged_df) != len(sub_df): raise RuntimeError("Lỗi merge khi tính điểm")
        calculated_score = accuracy_score(merged_df[''Outcome''], merged_df[''prediction''].round().astype(int))
        final_score = calculated_score
        print(f"Accuracy: {final_score}")
        print("--- Tính điểm OK ---")
    except ValueError as format_error: # Lỗi định dạng
        print(f"Lỗi Định dạng:\n{format_error}", file=sys.stderr); final_score = -1.0
        try:
            with open(output_path, ''w'') as f: f.write(str(final_score))
        except Exception as write_e: print(f"Lỗi ghi điểm format (-1): {write_e}", file=sys.stderr)
        sys.exit(1)
    except Exception as calc_error: # Lỗi tính toán/khác
        print(f"Lỗi Tính toán/Khác:\n{traceback.format_exc()}", file=sys.stderr); final_score = 0.0
        try:
            with open(output_path, ''w'') as f: f.write(str(final_score))
        except Exception as write_e: print(f"Lỗi ghi điểm tính toán (0): {write_e}", file=sys.stderr)
        sys.exit(1)
    try:
        with open(output_path, ''w'') as f: f.write(str(final_score))
        print(f"Ghi điểm cuối cùng: {final_score}")
    except Exception as e:
        print(f"Lỗi ghi điểm cuối cùng ({final_score}): {e}", file=sys.stderr); sys.exit(1)
if __name__ == "__main__":
    if len(sys.argv) != 5: print("Usage: python <script> <sub.csv> <gt.csv> <test.csv> <out.txt>", file=sys.stderr); sys.exit(1)
    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]); print("Chấm điểm hoàn tất.")
',
'id,Outcome\n1,0\n2,1\n3,0\n4,1\n5,1\n', -- Sample Ground Truth Content
'id,Feature1,Feature2\n1,10,20\n2,15,25\n3,12,22\n4,18,28\n5,20,30\n' -- Sample Public Test Content
);

-- Sample Problem 2: Regression (Added sample public_test_content)
INSERT INTO problems (id, name, difficulty, content, problem_type, author_id, datasets, evaluation_script, ground_truth_content, public_test_content) VALUES
(2, 'Dự đoán giá nhà', 'medium',
'## Mô tả\n\nDự đoán giá nhà dựa trên các đặc điểm của căn nhà.\n\n## Dữ liệu\n\n* `train.csv`: Dữ liệu huấn luyện với features và giá nhà (`SalePrice`).\n* `test.csv`: Dữ liệu kiểm tra chỉ chứa features.\n\n## Nộp bài\n\nNộp file csv có 2 cột: `id` và `prediction` (giá dự đoán).\n\n## Đánh giá\n\nSử dụng **Root Mean Squared Error (RMSE)**.\n',
'regression', 1,
'[{"split": "train", "filename": "house_train.csv"}, {"split": "public_test", "filename": "house_test.csv"}]',
'# Script chấm điểm mẫu: RMSE
import sys, pandas as pd, traceback
import numpy as np
from sklearn.metrics import mean_squared_error

# Args: submission_path, ground_truth_path, public_test_path, output_path
# Score: -1 (lỗi format), 0 (lỗi tính điểm), >=0 (điểm thực tế)

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    required_columns = [''id'', ''prediction'']
    final_score = -1.0 # Mặc định là lỗi format
    try:
        try: sub_df = pd.read_csv(submission_path)
        except Exception as e: raise ValueError(f"Lỗi đọc submission: {e}")
        try: gt_df = pd.read_csv(ground_truth_path)
        except Exception as e: raise RuntimeError(f"Lỗi đọc ground truth: {e}")
        try: test_df = pd.read_csv(public_test_path)
        except Exception as e: raise ValueError(f"Lỗi đọc public test: {e}")
        print("Kiểm tra định dạng...")
        missing_cols = [col for col in required_columns if col not in sub_df.columns]
        if missing_cols: raise ValueError(f"Thiếu cột: {missing_cols}")
        if len(sub_df) != len(test_df): raise ValueError(f"Sai số dòng: {len(sub_df)} vs {len(test_df)}")
        if ''id'' in test_df.columns:
            if not sub_df[''id''].sort_values().reset_index(drop=True).equals(test_df[''id''].sort_values().reset_index(drop=True)): raise ValueError("Sai lệch cột ''id''")
        if sub_df.isnull().values.any(): raise ValueError("Có giá trị thiếu (NaN/Null)")
        if not pd.api.types.is_numeric_dtype(sub_df[''prediction'']): raise ValueError("Cột ''prediction'' phải là số")
        # Kiểm tra giá trị prediction cho regression (không âm)
        if (sub_df[''prediction''] < 0).any(): raise ValueError("Cột ''prediction'' không được chứa giá trị âm")
        print("--- Định dạng OK ---")
        print("Tính điểm...")
        final_score = 0.0 # Mặc định 0 nếu lỗi tính điểm
        if ''id'' not in gt_df.columns or ''SalePrice'' not in gt_df.columns: raise ValueError("Ground truth thiếu cột ''id'' hoặc ''SalePrice''")
        merged_df = pd.merge(sub_df[[''id'', ''prediction'']], gt_df[[''id'', ''SalePrice'']], on=''id'', how=''inner'')
        if len(merged_df) != len(sub_df): raise RuntimeError("Lỗi merge khi tính điểm")
        # Tính RMSE
        calculated_score = mean_squared_error(merged_df[''SalePrice''], merged_df[''prediction''], squared=False)
        final_score = calculated_score
        print(f"RMSE: {final_score}")
        print("--- Tính điểm OK ---")
    except ValueError as format_error: # Lỗi định dạng
        print(f"Lỗi Định dạng:\n{format_error}", file=sys.stderr); final_score = -1.0
        try:
            with open(output_path, ''w'') as f: f.write(str(final_score))
        except Exception as write_e: print(f"Lỗi ghi điểm format (-1): {write_e}", file=sys.stderr)
        sys.exit(1)
    except Exception as calc_error: # Lỗi tính toán/khác
        print(f"Lỗi Tính toán/Khác:\n{traceback.format_exc()}", file=sys.stderr); final_score = 0.0
        try:
            with open(output_path, ''w'') as f: f.write(str(final_score))
        except Exception as write_e: print(f"Lỗi ghi điểm tính toán (0): {write_e}", file=sys.stderr)
        sys.exit(1)
    try:
        with open(output_path, ''w'') as f: f.write(str(final_score))
        print(f"Ghi điểm cuối cùng: {final_score}")
    except Exception as e:
        print(f"Lỗi ghi điểm cuối cùng ({final_score}): {e}", file=sys.stderr); sys.exit(1)
if __name__ == "__main__":
    if len(sys.argv) != 5: print("Usage: python <script> <sub.csv> <gt.csv> <test.csv> <out.txt>", file=sys.stderr); sys.exit(1)
    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]); print("Chấm điểm hoàn tất.")
',
'id,SalePrice\n1001,150000\n1002,220000\n1003,185000\n', -- Sample Ground Truth Content
'id,LotArea,YearBuilt\n1001,8450,2003\n1002,9600,1976\n1003,11250,2001\n' -- Sample Public Test Content
);

-- Link Problems to Tags/Metrics
INSERT INTO problem_tags (problem_id, tag_id) VALUES (1, 1), (1, 3), (1, 5), (2, 2), (2, 4), (2, 5);
INSERT INTO problem_metrics (problem_id, metric_id, is_primary) VALUES (1, 1, TRUE), (2, 2, TRUE);

-- Sample Discussion
INSERT INTO discussion_posts (id, problem_id, user_id, title, content) VALUES
(1, 1, 1, 'Cách tiếp cận ban đầu: Logistic Regression', 'Tôi đã thử dùng Logistic Regression đơn giản và đạt accuracy khoảng 0.75. Mọi người có cao kiến gì không?'),
(2, 2, 1, 'Feature Engineering cho Giá nhà?', 'Tôi đang phân vân nên thêm các feature nào để cải thiện mô hình RMSE...');

INSERT INTO discussion_comments (id, post_id, parent_id, user_id, content) VALUES
(1, 1, NULL, 1, 'Thử thêm feature scaling xem sao bạn.'),
(2, 2, NULL, 1, 'Polynomial features có thể hữu ích đó.');

-- Update sequences to avoid ID conflicts
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('problems', 'id'), COALESCE((SELECT MAX(id) FROM problems), 1));
SELECT setval(pg_get_serial_sequence('tags', 'id'), COALESCE((SELECT MAX(id) FROM tags), 1));
SELECT setval(pg_get_serial_sequence('metrics', 'id'), COALESCE((SELECT MAX(id) FROM metrics), 1));
SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 1));
SELECT setval(pg_get_serial_sequence('discussion_posts', 'id'), COALESCE((SELECT MAX(id) FROM discussion_posts), 1));
SELECT setval(pg_get_serial_sequence('discussion_comments', 'id'), COALESCE((SELECT MAX(id) FROM discussion_comments), 1));
SELECT setval(pg_get_serial_sequence('votes', 'id'), COALESCE((SELECT MAX(id) FROM votes), 1));
