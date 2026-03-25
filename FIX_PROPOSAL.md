**PR URL Validation Solution**
================================

To validate the PR URL, we will use the GitHub API to check if the PR exists, belongs to the correct repository, and is authored by the submitting user.

**Code Solution**
-----------------

```python
import requests

def validate_pr_url(pr_url, repo_owner, repo_name, submitting_user):
    """
    Validate the PR URL.

    Args:
    - pr_url (str): The PR URL to validate.
    - repo_owner (str): The owner of the repository.
    - repo_name (str): The name of the repository.
    - submitting_user (str): The username of the submitting user.

    Returns:
    - bool: True if the PR URL is valid, False otherwise.
    """
    # Extract the PR number from the PR URL
    pr_number = pr_url.split("/")[-1]

    # Construct the GitHub API URL for the PR
    api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}"

    # Send a GET request to the GitHub API
    response = requests.get(api_url)

    # Check if the response was successful
    if response.status_code == 200:
        # Get the PR data from the response
        pr_data = response.json()

        # Check if the PR belongs to the correct repository
        if pr_data["base"]["repo"]["owner"]["login"] == repo_owner and pr_data["base"]["repo"]["name"] == repo_name:
            # Check if the PR is authored by the submitting user
            if pr_data["user"]["login"] == submitting_user:
                return True

    return False

# Example usage
repo_owner = "devasignhq"
repo_name = "mobile-app"
pr_url = "https://github.com/devasignhq/mobile-app/pull/119"
submitting_user = "your-username"

if validate_pr_url(pr_url, repo_owner, repo_name, submitting_user):
    print("The PR URL is valid.")
else:
    print("The PR URL is not valid.")
```

**Explanation**
---------------

1. The `validate_pr_url` function takes four arguments: `pr_url`, `repo_owner`, `repo_name`, and `submitting_user`.
2. It extracts the PR number from the PR URL using string splitting.
3. It constructs the GitHub API URL for the PR using the `repo_owner`, `repo_name`, and `pr_number`.
4. It sends a GET request to the GitHub API using the `requests` library.
5. It checks if the response was successful (200 OK).
6. If the response was successful, it gets the PR data from the response using the `json()` method.
7. It checks if the PR belongs to the correct repository by comparing the `repo_owner` and `repo_name` with the values in the PR data.
8. It checks if the PR is authored by the submitting user by comparing the `submitting_user` with the `user` value in the PR data.
9. If all checks pass, it returns `True`, indicating that the PR URL is valid. Otherwise, it returns `False`.

**Commit Message**
------------------

`Implement PR URL validation for submissions`

**API Documentation**
---------------------

This solution uses the GitHub API to validate the PR URL. The API endpoint used is `GET /repos/{owner}/{repo}/pulls/{number}`, where `{owner}` is the repository owner, `{repo}` is the repository name, and `{number}` is the PR number. The API returns a JSON object containing the PR data, which is used to validate the PR URL.