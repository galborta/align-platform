// Danger Zone Tab - Nuclear Reset Options
// Replace the existing "Danger Zone Tab" section with this code

{/* Danger Zone Tab - ☢️ NUCLEAR OPTIONS */}
{currentTab === 'danger' && (
  <div className="space-y-6">
    {/* MASSIVE WARNING BANNER */}
    <Alert severity="error" className="border-4 border-red-600">
      <AlertTitle className="text-2xl font-bold">
        ☠️ DANGER ZONE ☠️
      </AlertTitle>
      <p className="text-lg font-semibold">
        ⚠️ THESE ACTIONS CANNOT BE UNDONE ⚠️
      </p>
      <p className="mt-2">
        You are about to perform destructive operations. All deletions are permanent and irreversible.
        Double confirmation is required for every action.
      </p>
    </Alert>

    {/* Cooldown Alert */}
    {resetCooldownUntil && (
      <Alert severity="warning">
        <AlertTitle>Cooldown Active</AlertTitle>
        <p>
          Another reset can be performed in: <strong>{formatCooldown(resetCooldownSeconds)}</strong>
        </p>
        <p className="text-sm mt-1">This cooldown prevents accidental double-resets.</p>
      </Alert>
    )}

    {/* Last Reset Result */}
    {lastResetResult && (
      <Alert severity="success" onClose={() => setLastResetResult(null)}>
        <AlertTitle>Reset Complete</AlertTitle>
        <pre className="text-xs mt-2 bg-white p-2 rounded">
          {JSON.stringify(lastResetResult, null, 2)}
        </pre>
      </Alert>
    )}

    {/* SELECTIVE RESETS */}
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-orange-600 border-b-4 border-orange-300 pb-2">
        🔥 Selective Resets
      </h2>

      {/* 1. Reset Pending Assets Only */}
      <Card className="border-4 border-orange-400 bg-orange-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-orange-800 mb-2">
                Reset Pending Assets Only
              </h3>
              <p className="text-gray-700 mb-4">
                Delete all pending assets (status = 'pending'). Keeps backed, verified, and hidden assets.
              </p>
              
              {/* What gets deleted */}
              <div className="mb-3">
                <button
                  onClick={() => setExpandedSections({
                    ...expandedSections,
                    pendingDeleted: { 
                      ...expandedSections.pendingDeleted,
                      deleted: !expandedSections.pendingDeleted?.deleted 
                    }
                  })}
                  className="flex items-center gap-2 text-red-600 font-semibold hover:underline"
                >
                  {expandedSections.pendingDeleted?.deleted ? '▼' : '▶'} What gets deleted
                </button>
                {expandedSections.pendingDeleted?.deleted && (
                  <div className="ml-6 mt-2 space-y-1 text-sm">
                    <p>✗ All pending_assets where verification_status = 'pending'</p>
                    <p>✗ All votes on these assets</p>
                    <p>✗ Karma earned from these assets (reversed)</p>
                    <p>✗ System messages about these assets</p>
                  </div>
                )}
              </div>

              {/* What stays safe */}
              <div className="mb-4">
                <button
                  onClick={() => setExpandedSections({
                    ...expandedSections,
                    pendingDeleted: { 
                      ...expandedSections.pendingDeleted,
                      safe: !expandedSections.pendingDeleted?.safe 
                    }
                  })}
                  className="flex items-center gap-2 text-green-600 font-semibold hover:underline"
                >
                  {expandedSections.pendingDeleted?.safe ? '▼' : '▶'} What stays safe
                </button>
                {expandedSections.pendingDeleted?.safe && (
                  <div className="ml-6 mt-2 space-y-1 text-sm">
                    <p>✓ Backed assets (verification_status = 'backed')</p>
                    <p>✓ Verified assets</p>
                    <p>✓ Hidden assets</p>
                    <p>✓ All verified asset tables (social/creative/legal)</p>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="bg-white p-3 rounded border-2 border-orange-200 mb-4">
                <p className="font-semibold text-sm mb-2">Preview:</p>
                {loadingPreviews.pending ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <p className="text-sm">
                    Will delete: <strong>{resetPreviews.pending?.assets || 0} pending assets</strong>
                  </p>
                )}
              </div>

              {/* Reset Button */}
              <MuiButton
                variant="contained"
                color="error"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('pending')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 16, fontWeight: 'bold' }}
              >
                🔥 RESET PENDING ASSETS
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Reset All Unverified Assets */}
      <Card className="border-4 border-orange-500 bg-orange-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-orange-900 mb-2">
                Reset All Unverified Assets
              </h3>
              <p className="text-gray-700 mb-4">
                Delete ALL unverified assets (pending + backed + hidden). Keeps only verified assets.
              </p>
              
              <div className="mb-3">
                <button
                  onClick={() => setExpandedSections({
                    ...expandedSections,
                    unverifiedDeleted: { 
                      ...expandedSections.unverifiedDeleted,
                      deleted: !expandedSections.unverifiedDeleted?.deleted 
                    }
                  })}
                  className="flex items-center gap-2 text-red-600 font-semibold hover:underline"
                >
                  {expandedSections.unverifiedDeleted?.deleted ? '▼' : '▶'} What gets deleted
                </button>
                {expandedSections.unverifiedDeleted?.deleted && (
                  <div className="ml-6 mt-2 space-y-1 text-sm">
                    <p>✗ All pending_assets (pending, backed, hidden)</p>
                    <p>✗ ALL votes</p>
                    <p>✗ ALL asset-related karma (reversed)</p>
                    <p>✗ ALL curation system messages</p>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <button
                  onClick={() => setExpandedSections({
                    ...expandedSections,
                    unverifiedDeleted: { 
                      ...expandedSections.unverifiedDeleted,
                      safe: !expandedSections.unverifiedDeleted?.safe 
                    }
                  })}
                  className="flex items-center gap-2 text-green-600 font-semibold hover:underline"
                >
                  {expandedSections.unverifiedDeleted?.safe ? '▼' : '▶'} What stays safe
                </button>
                {expandedSections.unverifiedDeleted?.safe && (
                  <div className="ml-6 mt-2 space-y-1 text-sm">
                    <p>✓ Verified assets in social_assets</p>
                    <p>✓ Verified assets in creative_assets</p>
                    <p>✓ Verified assets in legal_assets</p>
                    <p>✓ User chat messages</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-3 rounded border-2 border-orange-300 mb-4">
                <p className="font-semibold text-sm mb-2">Preview:</p>
                {loadingPreviews.unverified ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <p className="text-sm">
                    Will delete: <strong>{resetPreviews.unverified?.assets || 0} unverified assets</strong>
                  </p>
                )}
              </div>

              <MuiButton
                variant="contained"
                color="error"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('unverified')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 16, fontWeight: 'bold', bgcolor: '#F97316' }}
              >
                🔥 RESET ALL UNVERIFIED
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Reset Chat Messages */}
      <Card className="border-4 border-yellow-400 bg-yellow-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">💬</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-yellow-800 mb-2">
                Reset Chat Messages
              </h3>
              <p className="text-gray-700 mb-4">
                Delete all user chat messages. Optionally delete system curation messages too.
              </p>
              
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSystemMessages}
                    onChange={(e) => setIncludeSystemMessages(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-medium">Also delete system curation messages</span>
                </label>
              </div>

              <div className="bg-white p-3 rounded border-2 border-yellow-200 mb-4">
                <p className="font-semibold text-sm mb-2">Preview:</p>
                {loadingPreviews.chat ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <p>User messages: <strong>{resetPreviews.chat?.userMessages || 0}</strong></p>
                    {includeSystemMessages && (
                      <p>System messages: <strong>{resetPreviews.chat?.systemMessages || 0}</strong></p>
                    )}
                  </div>
                )}
              </div>

              <MuiButton
                variant="contained"
                color="warning"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('chat')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 16, fontWeight: 'bold' }}
              >
                💬 RESET CHAT MESSAGES
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Reset All Karma */}
      <Card className="border-4 border-purple-400 bg-purple-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">💎</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-purple-800 mb-2">
                Reset All Karma
              </h3>
              <p className="text-gray-700 mb-4">
                Set karma to 0 for all wallets. Clear warnings and unban everyone.
              </p>

              <div className="bg-white p-3 rounded border-2 border-purple-200 mb-4">
                <p className="font-semibold text-sm mb-2">Preview:</p>
                {loadingPreviews.karma ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <p className="text-sm">
                    Will reset: <strong>{resetPreviews.karma?.wallets || 0} wallets</strong>
                  </p>
                )}
              </div>

              <MuiButton
                variant="contained"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('karma')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 16, fontWeight: 'bold', bgcolor: '#9333EA' }}
              >
                💎 RESET ALL KARMA
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Reset All Votes */}
      <Card className="border-4 border-blue-400 bg-blue-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">🗳️</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-blue-800 mb-2">
                Reset All Votes
              </h3>
              <p className="text-gray-700 mb-4">
                Delete all votes. Reset vote weights on all assets. Keeps karma (historical).
              </p>

              <div className="bg-white p-3 rounded border-2 border-blue-200 mb-4">
                <p className="font-semibold text-sm mb-2">Preview:</p>
                {loadingPreviews.votes ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <p className="text-sm">
                    Will delete: <strong>{resetPreviews.votes?.votes || 0} votes</strong> on{' '}
                    <strong>{resetPreviews.votes?.assets || 0} assets</strong>
                  </p>
                )}
              </div>

              <MuiButton
                variant="contained"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('votes')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 16, fontWeight: 'bold', bgcolor: '#3B82F6' }}
              >
                🗳️ RESET ALL VOTES
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>
    </div>

    {/* NUCLEAR OPTIONS */}
    <div className="space-y-6 mt-12">
      <h2 className="text-3xl font-bold text-red-600 border-b-4 border-red-500 pb-2 flex items-center gap-3">
        ☢️ NUCLEAR OPTIONS ☢️
      </h2>
      <Alert severity="error" className="text-lg">
        <strong>EXTREME DANGER:</strong> These actions delete massive amounts of data. Only use for complete resets or project deletion.
      </Alert>

      {/* 6. Reset All Community Data */}
      <Card className="border-4 border-red-500 bg-red-50">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-5xl">☢️</span>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-red-900 mb-2">
                Reset All Community Data
              </h3>
              <p className="text-gray-700 mb-4 text-lg">
                Nuclear option: Delete ALL community curation data. Keeps verified assets and project profile.
              </p>

              <div className="bg-white p-3 rounded border-2 border-red-300 mb-4">
                <p className="font-semibold mb-2">Preview:</p>
                {loadingPreviews.community ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <p>Pending assets: <strong>{resetPreviews.community?.pendingAssets || 0}</strong></p>
                    <p>Votes: <strong>{resetPreviews.community?.votes || 0}</strong></p>
                    <p>System messages: <strong>{resetPreviews.community?.curationMessages || 0}</strong></p>
                    <p>Karma records: <strong>{resetPreviews.community?.karma || 0}</strong></p>
                  </div>
                )}
              </div>

              <MuiButton
                variant="contained"
                color="error"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('community')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 18, fontWeight: 'bold', py: 2 }}
              >
                ☢️ NUCLEAR: RESET COMMUNITY DATA
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 7. Reset Everything Except Profile */}
      <Card className="border-4 border-red-600 bg-red-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-5xl">💀</span>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-red-950 mb-2">
                Reset Everything Except Profile
              </h3>
              <p className="text-gray-800 mb-4 text-lg">
                ULTIMATE RESET: Delete EVERYTHING except project name/symbol/mint/description. Complete fresh start.
              </p>

              <div className="bg-white p-3 rounded border-2 border-red-400 mb-4">
                <p className="font-semibold mb-2">Preview:</p>
                {loadingPreviews.all ? (
                  <p className="text-sm">Calculating...</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <p>Social assets: <strong>{resetPreviews.all?.social || 0}</strong></p>
                    <p>Creative assets: <strong>{resetPreviews.all?.creative || 0}</strong></p>
                    <p>Legal assets: <strong>{resetPreviews.all?.legal || 0}</strong></p>
                    <p>Pending assets: <strong>{resetPreviews.all?.pending || 0}</strong></p>
                    <p>User chat: <strong>{resetPreviews.all?.userChat || 0}</strong></p>
                    <p>System messages: <strong>{resetPreviews.all?.systemChat || 0}</strong></p>
                    <p>Karma: <strong>{resetPreviews.all?.karma || 0}</strong></p>
                    <p>Team wallets: <strong>{resetPreviews.all?.team || 0}</strong></p>
                  </div>
                )}
              </div>

              <MuiButton
                variant="contained"
                color="error"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('all')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ fontSize: 18, fontWeight: 'bold', py: 2, bgcolor: '#991B1B' }}
              >
                💀 NUCLEAR: RESET EVERYTHING
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>

      {/* 8. Delete Project Completely */}
      <Card className="border-4 border-black bg-gray-900 text-white">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-5xl">🗑️</span>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">
                Delete Project Completely
              </h3>
              <p className="mb-4 text-lg">
                FINAL OPTION: Delete the entire project including profile. This action redirects to admin dashboard.
              </p>

              <Alert severity="error" className="mb-4">
                <AlertTitle>THIS CANNOT BE UNDONE</AlertTitle>
                The project and ALL associated data will be permanently deleted from the database.
              </Alert>

              <MuiButton
                variant="contained"
                size="large"
                fullWidth
                onClick={() => setResetConfirmDialog('delete')}
                disabled={!!resetCooldownUntil || processingReset}
                sx={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  py: 2,
                  bgcolor: '#000',
                  border: '2px solid white',
                  '&:hover': { bgcolor: '#1F2937' }
                }}
              >
                🗑️ DELETE PROJECT FOREVER
              </MuiButton>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
)}

{/* Confirmation Dialog */}
<Dialog 
  open={!!resetConfirmDialog} 
  onClose={() => !processingReset && setResetConfirmDialog(null)}
  maxWidth="sm" 
  fullWidth
>
  <DialogTitle className="bg-red-600 text-white text-xl">
    ⚠️ CONFIRM DESTRUCTIVE ACTION ⚠️
  </DialogTitle>
  <DialogContent className="mt-4">
    {resetConfirmDialog === 'pending' && (
      <div className="space-y-3">
        <Alert severity="error">This will delete all PENDING assets and their votes</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">reset pending</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="reset pending"
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'unverified' && (
      <div className="space-y-3">
        <Alert severity="error">This will delete ALL UNVERIFIED assets (pending/backed/hidden)</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">reset unverified</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="reset unverified"
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'chat' && (
      <div className="space-y-3">
        <Alert severity="warning">This will delete all chat messages</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">delete chat</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="delete chat"
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'karma' && (
      <div className="space-y-3">
        <Alert severity="warning">This will reset ALL karma to 0 and clear all warnings/bans</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">reset karma</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="reset karma"
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'votes' && (
      <div className="space-y-3">
        <Alert severity="warning">This will delete ALL votes on all assets</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">delete votes</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="delete votes"
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'community' && (
      <div className="space-y-3">
        <Alert severity="error">☢️ NUCLEAR: This will delete ALL community curation data</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">{project?.token_symbol} reset community</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder={`${project?.token_symbol} reset community`}
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'all' && (
      <div className="space-y-3">
        <Alert severity="error">💀 NUCLEAR: This will delete EVERYTHING except project profile</Alert>
        <p className="font-medium">Type <code className="bg-gray-200 px-2 py-1 rounded">{project?.token_symbol} reset all</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder={`${project?.token_symbol} reset all`}
          autoFocus
        />
      </div>
    )}

    {resetConfirmDialog === 'delete' && (
      <div className="space-y-3">
        <Alert severity="error">🗑️ This will DELETE THE ENTIRE PROJECT from the database</Alert>
        <p className="font-medium">Type the full project name <code className="bg-gray-200 px-2 py-1 rounded">{project?.token_name}</code> to confirm:</p>
        <TextField
          fullWidth
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder={project?.token_name}
          autoFocus
        />
      </div>
    )}

    {processingReset && (
      <div className="mt-4">
        <LinearProgress />
        <p className="text-center mt-2 text-sm text-gray-600">Processing reset...</p>
      </div>
    )}
  </DialogContent>
  <DialogActions>
    <MuiButton onClick={() => {
      setResetConfirmDialog(null)
      setResetConfirmText('')
    }} disabled={processingReset}>
      Cancel
    </MuiButton>
    <MuiButton
      variant="contained"
      color="error"
      onClick={() => {
        const confirmTexts: Record<string, string> = {
          pending: 'reset pending',
          unverified: 'reset unverified',
          chat: 'delete chat',
          karma: 'reset karma',
          votes: 'delete votes',
          community: `${project?.token_symbol} reset community`,
          all: `${project?.token_symbol} reset all`,
          delete: project?.token_name || ''
        }

        if (resetConfirmText === confirmTexts[resetConfirmDialog]) {
          switch (resetConfirmDialog) {
            case 'pending':
              resetPendingAssetsOnly()
              break
            case 'unverified':
              resetUnverifiedAssets()
              break
            case 'chat':
              resetChatMessagesFunc()
              break
            case 'karma':
              resetAllKarmaFunc()
              break
            case 'votes':
              resetAllVotesFunc()
              break
            case 'community':
              nuclearResetCommunity()
              break
            case 'all':
              nuclearResetAll()
              break
            case 'delete':
              deleteProjectCompletely()
              break
          }
        } else {
          toast.error('Confirmation text does not match')
        }
      }}
      disabled={processingReset || !resetConfirmText}
    >
      {processingReset ? 'Processing...' : 'CONFIRM RESET'}
    </MuiButton>
  </DialogActions>
</Dialog>

