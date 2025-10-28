# RMSE chấm bài Giá nhà – phiên bản ổn định cho microservice (4 args)

import sys
import pandas as pd
import numpy as np
import traceback

def write_score(path, value):
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(str(float(value)))
    except Exception as e:
        print("Ghi điểm lỗi:", e, file=sys.stderr)

def fail_format(path, msg):
    print("LỖI ĐỊNH DẠNG:", msg, file=sys.stderr)
    write_score(path, -1.0)
    sys.exit(1)

def fail_calc(path, msg):
    print("LỖI TÍNH TOÁN/KHÁC:", msg, file=sys.stderr)
    print("Traceback:")
    print(traceback.format_exc())
    write_score(path, 0.0)
    sys.exit(1)

def find_pred_col(df):
    # Ưu tiên các tên cột phổ biến; nếu không, chọn đúng 1 cột khác 'id'
    candidates = ["SalePrice", "prediction", "pred", "target", "y_pred"]
    for c in candidates:
        if c in df.columns:
            return c
    non_id = [c for c in df.columns if c.lower() != "id"]
    return non_id[0] if len(non_id) == 1 else None

def find_target_col(df):
    # Ưu tiên "SalePrice"; nếu không, chọn đúng 1 cột khác 'id'
    if "SalePrice" in df.columns:
        return "SalePrice"
    non_id = [c for c in df.columns if c.lower() != "id"]
    return non_id[0] if len(non_id) == 1 else None

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    # 1) Đọc & kiểm tra submission
    try:
        sub = pd.read_csv(submission_path)
    except Exception as e:
        fail_format(output_path, f"Không đọc được submission: {e}")

    if "id" not in sub.columns:
        fail_format(output_path, "Submission thiếu cột 'id'.")

    pred_col = find_pred_col(sub)
    if pred_col is None:
        fail_format(output_path, "Không xác định được cột dự đoán (cần 'SalePrice' hoặc đúng 1 cột ngoài 'id').")

    if sub[pred_col].isnull().any():
        fail_format(output_path, f"Cột '{pred_col}' trong submission có NaN.")

    # 2) Đọc & kiểm tra ground truth
    try:
        gt = pd.read_csv(ground_truth_path)
    except Exception as e:
        fail_calc(output_path, f"Không đọc được ground truth: {e}")

    if "id" not in gt.columns:
        fail_calc(output_path, "Ground truth thiếu cột 'id'.")

    target_col = find_target_col(gt)
    if target_col is None:
        fail_calc(output_path, "Không xác định được cột target trong ground truth.")

    # 3) Merge với suffix để tránh đụng tên cột
    try:
        merged = pd.merge(
            sub[["id", pred_col]],
            gt[["id", target_col]],
            on="id",
            how="inner",
            suffixes=("_sub", "_gt"),
        )
    except Exception as e:
        fail_calc(output_path, f"Lỗi merge: {e}")

    if merged.empty:
        fail_calc(output_path, "Không có ID nào khớp giữa submission và ground truth.")

    # 4) Tính RMSE bằng NumPy (không cần scikit-learn)
    y_true = pd.to_numeric(merged[f"{target_col}_gt"], errors="coerce")
    y_pred = pd.to_numeric(merged[f"{pred_col}_sub"], errors="coerce")

    mask = y_true.notna() & y_pred.notna()
    if mask.sum() == 0:
        fail_calc(output_path, "Không có cặp (y_true, y_pred) hợp lệ để tính điểm.")

    rmse = float(np.sqrt(((y_true[mask] - y_pred[mask]) ** 2).mean()))
    score = -rmse
    def sigmoid(z):
        return 1 / (1 + np.exp(-z))
    score = 2 * sigmoid(score)
    write_score(output_path, score)
    print(f"Đã ghi điểm: {rmse}")
    sys.exit(0)



if __name__ == "__main__":
    # Microservice gọi với 4 args; hỗ trợ 3 args để test local
    if len(sys.argv) == 5:
        _, sub_p, gt_p, pub_p, out_p = sys.argv
        evaluate(sub_p, gt_p, pub_p, out_p)
    elif len(sys.argv) == 4:
        _, sub_p, gt_p, out_p = sys.argv
        evaluate(sub_p, gt_p, None, out_p)
    else:
        # Cố gắng ghi -1.0 nếu có output ở cuối
        out_p = sys.argv[-1] if len(sys.argv) >= 2 else "output.txt"
        try:
            write_score(out_p, -1.0)
        except Exception:
            pass
        print("Script cần 4 args: <submission> <ground_truth> <public_test> <output>", file=sys.stderr)
        sys.exit(1)
