// This is the comprehensive Pending Assets tab UI
// Replace the existing "Pending Assets Tab" section in page.tsx with this code

{/* Pending Assets Tab - Comprehensive Management */}
{currentTab === 'pending-assets' && (
  <div className="space-y-6">
    <Alert severity="warning">
      <AlertTitle>Pending Assets Management</AlertTitle>
      Assets awaiting community verification. Admin can quick-approve, edit, or delete assets.
    </Alert>

    {/* Quick Stats Cards */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {(() => {
        const stats = getPendingStats()
        return (
          <>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-text-muted">Total Pending</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.backed}</p>
              <p className="text-xs text-text-muted">Backed</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              <p className="text-xs text-text-muted">Verified</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.hidden}</p>
              <p className="text-xs text-text-muted">Hidden</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.totalVotes}</p>
              <p className="text-xs text-text-muted">Total Votes</p>
            </Card>
          </>
        )
      })()}
    </div>

    {/* Filters & Search */}
    <Card className="p-4">
      <h3 className="font-display text-sm font-semibold mb-3 text-text-muted uppercase">Filters & Sort</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={pendingStatusFilter}
            label="Status"
            onChange={(e) => setPendingStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="backed">Backed</MenuItem>
            <MenuItem value="verified">Verified</MenuItem>
            <MenuItem value="hidden">Hidden</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Type</InputLabel>
          <Select
            value={pendingTypeFilter}
            label="Type"
            onChange={(e) => setPendingTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="social">Social</MenuItem>
            <MenuItem value="creative">Creative</MenuItem>
            <MenuItem value="legal">Legal</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Sort By</InputLabel>
          <Select
            value={pendingSort}
            label="Sort By"
            onChange={(e) => setPendingSort(e.target.value)}
          >
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
            <MenuItem value="most-upvotes">Most Upvotes</MenuItem>
            <MenuItem value="most-reports">Most Reports</MenuItem>
            <MenuItem value="closest">Closest to Verified</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          label="Search Wallet"
          placeholder="Wallet address..."
          value={pendingWalletSearch}
          onChange={(e) => setPendingWalletSearch(e.target.value)}
        />

        <MuiButton
          variant="outlined"
          size="small"
          onClick={() => {
            setPendingStatusFilter('all')
            setPendingTypeFilter('all')
            setPendingSort('newest')
            setPendingWalletSearch('')
          }}
        >
          Clear Filters
        </MuiButton>
      </div>
    </Card>

    {/* Bulk Actions */}
    {selectedPendingAssets.size > 0 && (
      <Card className="p-4 bg-purple-50 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Chip label={`${selectedPendingAssets.size} selected`} color="primary" />
            <MuiButton size="small" onClick={() => setSelectedPendingAssets(new Set())}>
              Clear Selection
            </MuiButton>
          </div>
          <div className="flex gap-2">
            <MuiButton
              variant="contained"
              size="small"
              onClick={handleBulkApprovePending}
              disabled={processingPendingAction}
              sx={{ bgcolor: '#10B981' }}
            >
              Approve All
            </MuiButton>
            <MuiButton
              variant="contained"
              size="small"
              color="warning"
              onClick={handleBulkHidePending}
              disabled={processingPendingAction}
            >
              Hide All
            </MuiButton>
            <MuiButton
              variant="contained"
              size="small"
              color="error"
              onClick={handleBulkDeletePending}
              disabled={processingPendingAction}
            >
              Delete All
            </MuiButton>
          </div>
        </div>
      </Card>
    )}

    {/* Assets Table */}
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedPendingAssets.size === filteredPendingAssets.length && filteredPendingAssets.length > 0}
                  onChange={() => {
                    if (selectedPendingAssets.size === filteredPendingAssets.length) {
                      setSelectedPendingAssets(new Set())
                    } else {
                      setSelectedPendingAssets(new Set(filteredPendingAssets.map(a => a.id)))
                    }
                  }}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Asset</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Submitter</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Votes</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progress</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPendingAssets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                  No pending assets found
                </td>
              </tr>
            ) : (
              filteredPendingAssets.map((asset) => {
                const progress = calculateVerificationProgress(asset)
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPendingAssets.has(asset.id)}
                        onChange={() => {
                          const newSet = new Set(selectedPendingAssets)
                          if (newSet.has(asset.id)) {
                            newSet.delete(asset.id)
                          } else {
                            newSet.add(asset.id)
                          }
                          setSelectedPendingAssets(newSet)
                        }}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Chip label={asset.asset_type.toUpperCase()} size="small" sx={{ fontSize: 9 }} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-xs">
                        <p className="text-sm font-medium truncate">
                          {extractAssetSummary(asset.asset_type, asset.asset_data)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{shortenAddress(asset.submitter_wallet)}</span>
                        <button onClick={() => copyToClipboard(asset.submitter_wallet)}>
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">{asset.submitter_token_percentage.toFixed(2)}%</p>
                    </td>
                    <td className="px-3 py-3">
                      <Chip 
                        label={asset.verification_status.toUpperCase()} 
                        size="small"
                        color={getStatusColor(asset.verification_status)}
                        sx={{ fontSize: 9 }}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">↑ {asset.unique_upvoters_count}</span>
                          <span className="text-gray-400">({asset.total_upvote_weight.toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-red-600">↓ {asset.unique_reporters_count}</span>
                          <span className="text-gray-400">({asset.total_report_weight.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-24">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{progress.toFixed(0)}%</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <MuiButton
                          size="small"
                          onClick={() => setViewingAsset(asset)}
                          title="View Details"
                        >
                          👁️
                        </MuiButton>
                        <MuiButton
                          size="small"
                          variant="contained"
                          onClick={() => handleQuickApprove(asset)}
                          disabled={processingPendingAction}
                          sx={{ bgcolor: '#10B981', minWidth: 'auto', px: 1 }}
                          title="Quick Approve"
                        >
                          ✓
                        </MuiButton>
                        <MuiButton
                          size="small"
                          onClick={() => handleEditPendingAsset(asset)}
                          title="Edit"
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </MuiButton>
                        <MuiButton
                          size="small"
                          color="error"
                          onClick={() => setDeletingAsset(asset)}
                          title="Delete"
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </MuiButton>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        Showing {filteredPendingAssets.length} of {pendingAssetsWithVotes.length} pending assets
      </div>
    </Card>

    {/* View Details Modal */}
    <Dialog open={!!viewingAsset} onClose={() => setViewingAsset(null)} maxWidth="md" fullWidth>
      <DialogTitle>Asset Details</DialogTitle>
      <DialogContent>
        {viewingAsset && (
          <div className="space-y-4 mt-2">
            {/* Asset Summary */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Asset Information</h4>
              <p className="text-lg font-medium">{extractAssetSummary(viewingAsset.asset_type, viewingAsset.asset_data)}</p>
              <Chip label={viewingAsset.asset_type.toUpperCase()} size="small" className="mt-2" />
            </div>

            {/* Full Asset Data */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Asset Data (JSONB)</h4>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-48 border">
                {JSON.stringify(viewingAsset.asset_data, null, 2)}
              </pre>
            </div>

            {/* Submitter Details */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Submitter Details</h4>
              <div className="bg-gray-50 p-3 rounded space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Wallet:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{viewingAsset.submitter_wallet}</span>
                    <button onClick={() => copyToClipboard(viewingAsset.submitter_wallet)}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Supply %:</span>
                  <span>{viewingAsset.submitter_token_percentage.toFixed(3)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Submitted:</span>
                  <span>{new Date(viewingAsset.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Karma Earned:</span>
                  <span>{viewingAsset.submitter_karma_earned || 0} points</span>
                </div>
              </div>
            </div>

            {/* Voting Breakdown */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Voting Breakdown ({viewingAsset.votes.length} votes)</h4>
              {viewingAsset.votes.length === 0 ? (
                <p className="text-sm text-gray-500">No votes yet</p>
              ) : (
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">Voter</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-right">Token %</th>
                        <th className="px-2 py-2 text-right">Karma</th>
                        <th className="px-2 py-2 text-right">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingAsset.votes.map((vote, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-2 py-2 font-mono">{shortenAddress(vote.voter_wallet)}</td>
                          <td className="px-2 py-2">
                            <Chip 
                              label={vote.vote_type === 'upvote' ? 'UPVOTE' : 'REPORT'}
                              size="small"
                              color={vote.vote_type === 'upvote' ? 'success' : 'error'}
                              sx={{ fontSize: 8, height: 16 }}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">{vote.token_percentage_snapshot.toFixed(3)}%</td>
                          <td className="px-2 py-2 text-right">{vote.karma_earned || 0}</td>
                          <td className="px-2 py-2 text-right">{formatDistanceToNow(new Date(vote.created_at), { addSuffix: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Status History */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Status</h4>
              <Chip label={viewingAsset.verification_status.toUpperCase()} color={getStatusColor(viewingAsset.verification_status)} />
              {viewingAsset.verified_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Verified {formatDistanceToNow(new Date(viewingAsset.verified_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => setViewingAsset(null)}>Close</MuiButton>
      </DialogActions>
    </Dialog>

    {/* Edit Asset Modal */}
    <Dialog open={!!editingPendingAsset} onClose={() => setEditingPendingAsset(null)} maxWidth="md" fullWidth>
      <DialogTitle>Edit Pending Asset</DialogTitle>
      <DialogContent>
        <div className="space-y-4 mt-2">
          <Alert severity="warning">
            Edit asset data carefully. Invalid JSON will be rejected.
          </Alert>

          <TextField
            label="Asset Data (JSON)"
            fullWidth
            multiline
            rows={12}
            value={pendingAssetFormData.assetData || ''}
            onChange={(e) => setPendingAssetFormData({ ...pendingAssetFormData, assetData: e.target.value })}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '12px' } }}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={pendingAssetFormData.status || 'pending'}
              label="Status"
              onChange={(e) => setPendingAssetFormData({ ...pendingAssetFormData, status: e.target.value })}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="backed">Backed</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="hidden">Hidden</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Admin Note (optional)"
            fullWidth
            multiline
            rows={2}
            value={pendingAssetFormData.adminNote || ''}
            onChange={(e) => setPendingAssetFormData({ ...pendingAssetFormData, adminNote: e.target.value })}
            helperText="Internal note, stored in asset_data.admin_note"
          />
        </div>
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => setEditingPendingAsset(null)}>Cancel</MuiButton>
        <MuiButton variant="contained" onClick={handleSavePendingAsset} disabled={processingPendingAction}>
          {processingPendingAction ? 'Saving...' : 'Save Changes'}
        </MuiButton>
      </DialogActions>
    </Dialog>

    {/* Delete Asset Modal */}
    <Dialog open={!!deletingAsset} onClose={() => { setDeletingAsset(null); setDeleteConfirmText('') }} maxWidth="sm" fullWidth>
      <DialogTitle className="text-red-600">⚠️ Delete Pending Asset</DialogTitle>
      <DialogContent>
        {deletingAsset && (
          <div className="space-y-4 mt-2">
            <Alert severity="error">
              <AlertTitle>This action cannot be undone!</AlertTitle>
              This will permanently delete the asset and reverse all karma.
            </Alert>

            <div className="bg-red-50 p-3 rounded space-y-2 text-sm">
              <p><strong>Asset:</strong> {extractAssetSummary(deletingAsset.asset_type, deletingAsset.asset_data)}</p>
              <p><strong>Votes to delete:</strong> {deletingAsset.votes.length} ({deletingAsset.unique_upvoters_count} upvotes, {deletingAsset.unique_reporters_count} reports)</p>
              <p><strong>Karma to reverse:</strong> {deletingAsset.votes.reduce((sum, v) => sum + (v.karma_earned || 0), 0)} points</p>
              <p><strong>System messages:</strong> Will be deleted</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Type <code className="bg-gray-100 px-2 py-1 rounded">{deletingAsset.asset_data.handle || deletingAsset.asset_data.name || 'DELETE'}</code> to confirm:
              </p>
              <TextField
                fullWidth
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type here..."
              />
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => { setDeletingAsset(null); setDeleteConfirmText('') }}>Cancel</MuiButton>
        <MuiButton 
          variant="contained" 
          color="error" 
          onClick={handleDeletePendingAsset} 
          disabled={processingPendingAction || !deleteConfirmText}
        >
          {processingPendingAction ? 'Deleting...' : 'Delete Permanently'}
        </MuiButton>
      </DialogActions>
    </Dialog>
  </div>
)}

