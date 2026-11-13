Short: Subscription tasks in Bedrock projects

Picking a Claude subscription account for a task now unsets the project's Bedrock switch and Bedrock model ids from its env, so a project that sets Bedrock in `.dev3/config` can still run subscription tasks next to Bedrock ones. Deleting a task while its page is open now returns to the board instead of leaving a dead "Terminal session ended" screen whose buttons did nothing.
