import os
import subprocess
import tempfile
import traceback
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import time # Import time for measuring execution

app = Flask(__name__)

# Directory to temporarily store files during evaluation
UPLOAD_FOLDER = 'temp_eval'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/evaluate', methods=['POST'])
def evaluate_submission():
    """
    Receives submission, ground truth, public test, and script content.
    Runs the script.
    Returns structured status ('succeeded', 'failed'), score (actual score, -1.0, 0.0, or None),
    runtime, and error message.
    """
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    submission_content = data.get('submission_file_content')
    ground_truth_content = data.get('ground_truth_content')
    public_test_content = data.get('public_test_content')
    script_content = data.get('evaluation_script_content')
    runtime_ms = None # Initialize runtime

    # Validation: Ensure all required content is present
    if not all([submission_content, ground_truth_content, public_test_content, script_content]):
        missing = [k for k, v in {
            "submission_file_content": submission_content,
            "ground_truth_content": ground_truth_content,
            "public_test_content": public_test_content,
            "evaluation_script_content": script_content
        }.items() if not v]
        print(f"Evaluation request failed: Missing content for {missing}") # Log missing keys
        return jsonify({"error": f"Missing content: {', '.join(missing)}"}), 400

    submission_path = None
    ground_truth_path = None
    public_test_path = None
    script_path = None
    output_path = None
    start_time = time.perf_counter() # Start timer before file operations

    try:
        # Create temporary files using a context manager for automatic cleanup (delete=True is default)
        # Using NamedTemporaryFile ensures unique names even with concurrent requests
        with tempfile.NamedTemporaryFile(mode='w', suffix='_submission.csv', delete=False, dir=app.config['UPLOAD_FOLDER'], encoding='utf-8') as sub_file, \
             tempfile.NamedTemporaryFile(mode='w', suffix='_ground_truth.csv', delete=False, dir=app.config['UPLOAD_FOLDER'], encoding='utf-8') as gt_file, \
             tempfile.NamedTemporaryFile(mode='w', suffix='_public_test.csv', delete=False, dir=app.config['UPLOAD_FOLDER'], encoding='utf-8') as pt_file, \
             tempfile.NamedTemporaryFile(mode='w', suffix='_eval_script.py', delete=False, dir=app.config['UPLOAD_FOLDER'], encoding='utf-8') as script_file, \
             tempfile.NamedTemporaryFile(mode='w', suffix='_output.txt', delete=False, dir=app.config['UPLOAD_FOLDER'], encoding='utf-8') as output_file:

            submission_path = sub_file.name
            ground_truth_path = gt_file.name
            public_test_path = pt_file.name
            script_path = script_file.name
            output_path = output_file.name

            sub_file.write(submission_content)
            gt_file.write(ground_truth_content)
            pt_file.write(public_test_content)
            script_file.write(script_content)

            # Ensure data is written before subprocess call
            sub_file.flush()
            gt_file.flush()
            pt_file.flush()
            script_file.flush()
            output_file.flush() # Flush output file handle too

        print(f"Running script: {script_path}")
        print(f"Submission file: {submission_path}")
        print(f"Ground Truth file: {ground_truth_path}")
        print(f"Public test file: {public_test_path}")
        print(f"Output file: {output_path}")

        # Execute the evaluation script
        command = ['python', script_path, submission_path, ground_truth_path, public_test_path, output_path]

        score = None
        process_error = None
        status = "failed" # Default status to failed

        try:
            process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                # check=False, # MODIFIED: Do not raise error on non-zero exit code
                timeout=45, # Keep timeout
                encoding='utf-8',
                errors='replace'
            )

            end_time = time.perf_counter()
            runtime_ms = (end_time - start_time) * 1000

            stdout = process.stdout
            stderr = process.stderr

            print(f"Script STDOUT:\n{stdout}")
            if stderr:
                print(f"Script STDERR:\n{stderr}")

            # Always try to read the score from the output file, regardless of exit code
            score_str = ""
            try:
                with open(output_path, 'r', encoding='utf-8') as f:
                    score_str = f.read().strip()
                score = float(score_str)
                # Allow -1.0 and 0.0 as valid scores reported by the script on failure
                if not (score == -1.0 or score == 0.0 or score >= 0):
                     raise ValueError(f"Score read from file ({score}) is not -1.0, 0.0, or >= 0.")
            except (IOError, ValueError) as e:
                # If we cannot read/parse score, it's a critical failure of the script contract
                process_error = f"Failed to read/parse score from output file '{output_path}': {e}. Script stderr: {stderr}"
                print(process_error)
                score = None # Ensure score is None if reading fails
                # Keep status as "failed"

            # Check the script's exit code AFTER attempting to read score
            if process.returncode != 0:
                process_error = f"Script exited with error code {process.returncode}. Stderr: {stderr}"
                print(process_error)
                status = "failed" # Confirm status is failed
                # Use the score read from the file (-1.0 or 0.0) if available
            elif score is None:
                # Script exited successfully (0), but we failed to get a score (e.g., empty output file)
                process_error = f"Script exited successfully but failed to write a valid score to '{output_path}'. Script stderr: {stderr}"
                print(process_error)
                status = "failed" # Treat as failure
                score = None
            elif score < 0:
                # Script exited successfully (0) but reported an invalid negative score (not -1.0)
                # This contradicts the contract.
                process_error = f"Script exited successfully but reported an invalid negative score: {score}. Expected -1.0 for format error or >= 0 for success."
                print(process_error)
                status = "failed"
                score = None # Discard the invalid score
            else:
                 # Script exited successfully (0) AND score is valid (>= 0)
                 status = "succeeded"
                 process_error = None # Clear any previous error messages if successful now

            # Return the result (status is now correctly determined)
            # Score can be None, -1.0, 0.0, or >= 0
            return jsonify({"status": status, "score": score, "runtime_ms": runtime_ms, "error": process_error}), 200

        except subprocess.TimeoutExpired as e:
            end_time = time.perf_counter()
            runtime_ms = (end_time - start_time) * 1000
            stderr_output = e.stderr.strip() if e.stderr else "No stderr output."
            process_error = f"Evaluation script timed out after {e.timeout} seconds. Stderr: {stderr_output}"
            print(process_error)
            # Timeout is always a failure with no score
            return jsonify({"status": "failed", "error": process_error, "score": None, "runtime_ms": runtime_ms}), 200

        except Exception as e:
            # Catch unexpected errors during subprocess execution (e.g., file not found if temp dir cleaned early)
            end_time = time.perf_counter()
            runtime_ms = (end_time - start_time) * 1000
            process_error = f"Unexpected error during script execution: {str(e)}"
            print(f"Unexpected execution error: {traceback.format_exc()}")
            # Return 500 for internal errors
            return jsonify({"status": "failed", "error": process_error, "score": None, "runtime_ms": runtime_ms}), 500

    except Exception as e:
        # Error creating/writing temporary files before execution
        end_time = time.perf_counter() # Measure time even for setup failure
        runtime_ms = (end_time - start_time) * 1000
        process_error = f"Internal server error setting up evaluation: {str(e)}"
        print(f"Error setting up evaluation files: {traceback.format_exc()}")
        return jsonify({"status": "failed", "error": process_error, "score": None, "runtime_ms": runtime_ms}), 500
    finally:
        # Cleanup: Attempt to remove the temporary files
        for path in [submission_path, ground_truth_path, public_test_path, script_path, output_path]:
             if path and os.path.exists(path):
                 try: os.remove(path)
                 except OSError as e: print(f"Warning: Error removing temp file {path}: {e}")

if __name__ == '__main__':
    # Use Gunicorn or Waitress in production instead of Flask's development server
    # For development:
    app.run(host='0.0.0.0', port=5002, debug=os.environ.get('FLASK_ENV') == 'development')
