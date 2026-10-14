# Portfolio project workflow

For every user request to change this website:

1. Implement the requested changes in the code.
2. Verify that the site works correctly, using checks appropriate to the change.
3. Create a Git commit with a concise description in English.
4. Automatically run `git push origin main` to send the changes to GitHub.
5. Modify only files relevant to the task. Do not commit unrelated changes.
6. Never force-push or delete existing commits.
7. After a successful push, tell the user that the changes have been published to GitHub. Do not claim that a hosting deployment succeeded unless it has been verified separately.

The user authorizes this commit-and-push workflow without an additional confirmation for each website change. Respect any explicit exception in a later user request, such as read-only work or no push.

If verification or pushing fails, report the issue accurately instead of claiming publication. Resolve remote branch divergence without rewriting existing history.

Creating or updating this file is itself a project change. Its initial creation must be committed and pushed in a separate commit.
