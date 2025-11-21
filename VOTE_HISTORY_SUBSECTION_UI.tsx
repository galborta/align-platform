// Vote History Subsection - Add to Karma & Votes Tab
// Insert this AFTER the Karma Leaderboard section in the Karma & Votes tab

{/* Vote History Subsection */}
<div className="mt-8 border-t-4 border-purple-200 pt-8">
  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
    📊 Vote History & Analytics
  </h2>

  {loadingVotes ? (
    <Card className="p-12 text-center">
      <p className="text-gray-500">Loading vote data...</p>
    </Card>
  ) : (
    <>
      {/* Vote Analytics Cards */}
      {voteAnalytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <Card className="p-3 text-center">
            <p className="text-xl font-bold">{voteAnalytics.totalVotes.toLocaleString()}</p>
            <p className="text-xs text-text-muted">Total Votes</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-green-600">
              {voteAnalytics.upvotes.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted">
              Upvotes ({voteAnalytics.upvotePercentage.toFixed(0)}%)
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-red-600">
              {voteAnalytics.reports.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted">
              Reports ({voteAnalytics.reportPercentage.toFixed(0)}%)
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-blue-600">
              {voteAnalytics.avgVoteWeight.toFixed(2)}%
            </p>
            <p className="text-xs text-text-muted">Avg Vote Weight</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs font-mono text-purple-600">
              {voteAnalytics.topVoter ? shortenAddress(voteAnalytics.topVoter) : 'N/A'}
            </p>
            <p className="text-xs text-text-muted">
              Most Active ({voteAnalytics.topVoterCount} votes)
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs">
              {voteAnalytics.mostVotedAsset 
                ? extractAssetSummary(voteAnalytics.mostVotedAsset.asset_data).substring(0, 20)
                : 'N/A'}
            </p>
            <p className="text-xs text-text-muted">
              Most Voted ({voteAnalytics.mostVotedAssetCount} votes)
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-amber-600">
              {voteAnalytics.karmaAccuracy.toFixed(0)}%
            </p>
            <p className="text-xs text-text-muted">Karma Accuracy</p>
          </Card>
        </div>
      )}

      {/* Suspicious Activity Alert */}
      {suspiciousActivity.length > 0 && (
        <Alert severity="warning" className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <AlertTitle>⚠️ Suspicious Activity Detected</AlertTitle>
              <p className="text-sm">
                {suspiciousActivity.length} wallet(s) flagged for suspicious voting patterns
              </p>
            </div>
            <MuiButton
              size="small"
              variant="contained"
              color="warning"
              onClick={() => setShowSuspiciousModal(true)}
            >
              Review Activity
            </MuiButton>
          </div>
        </Alert>
      )}

      {/* Filters & Actions */}
      <Card className="p-4 mb-6">
        <h3 className="font-display text-sm font-semibold mb-3 text-text-muted uppercase">
          Filters & Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <FormControl fullWidth size="small">
            <InputLabel>Vote Type</InputLabel>
            <Select
              value={voteTypeFilter}
              label="Vote Type"
              onChange={(e) => setVoteTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="upvote">Upvotes Only ⬆️</MenuItem>
              <MenuItem value="report">Reports Only ⬇️</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Outcome</InputLabel>
            <Select
              value={voteOutcomeFilter}
              label="Outcome"
              onChange={(e) => setVoteOutcomeFilter(e.target.value)}
            >
              <MenuItem value="all">All Outcomes</MenuItem>
              <MenuItem value="earned">Earned Karma ✅</MenuItem>
              <MenuItem value="lost">Lost Karma ❌</MenuItem>
              <MenuItem value="pending">Pending ⏳</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Voter Search"
            placeholder="Wallet..."
            value={voteVoterSearch}
            onChange={(e) => setVoteVoterSearch(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            label="Asset Search"
            placeholder="Asset name..."
            value={voteAssetSearch}
            onChange={(e) => setVoteAssetSearch(e.target.value)}
          />

          <div className="flex gap-2">
            <MuiButton
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => {
                setVoteTypeFilter('all')
                setVoteOutcomeFilter('all')
                setVoteVoterSearch('')
                setVoteAssetSearch('')
              }}
            >
              Clear
            </MuiButton>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <MuiButton
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={exportVotesCSV}
          >
            Export Votes CSV
          </MuiButton>
          <MuiButton
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={exportKarmaReport}
          >
            Export Karma Report
          </MuiButton>
        </div>
      </Card>

      {/* All Votes Data Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Timestamp
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Voter
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Asset
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Vote
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Token %
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Karma
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Outcome
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                    No votes found matching filters
                  </td>
                </tr>
              ) : (
                filteredVotes
                  .slice(votesPage * votesPerPage, (votesPage + 1) * votesPerPage)
                  .map((vote) => {
                    const outcome = getVoteOutcome(vote)
                    const asset = vote.pending_asset
                    return (
                      <tr key={vote.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm">
                          {new Date(vote.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {shortenAddress(vote.voter_wallet)}
                            </span>
                            <button onClick={() => copyToClipboard(vote.voter_wallet)}>
                              <ContentCopyIcon sx={{ fontSize: 12 }} />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm max-w-[200px] truncate">
                          {asset ? (
                            <div className="flex items-center gap-2">
                              <Chip
                                label={asset.asset_type}
                                size="small"
                                sx={{ fontSize: 9 }}
                              />
                              <span>{extractAssetSummary(asset.asset_data)}</span>
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Chip
                            label={vote.vote_type === 'upvote' ? '⬆️ Upvote' : '⬇️ Report'}
                            size="small"
                            color={vote.vote_type === 'upvote' ? 'success' : 'error'}
                            sx={{ fontSize: 10 }}
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium">
                          {(vote.token_percentage_snapshot || 0).toFixed(3)}%
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`text-sm font-bold ${
                              (vote.karma_earned || 0) > 0
                                ? 'text-green-600'
                                : (vote.karma_earned || 0) < 0
                                ? 'text-red-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {vote.karma_earned || 0 > 0 ? '+' : ''}
                            {vote.karma_earned || 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {outcome === 'earned' && (
                            <Chip label="✅ Earned" size="small" color="success" sx={{ fontSize: 9 }} />
                          )}
                          {outcome === 'lost' && (
                            <Chip label="❌ Lost" size="small" color="error" sx={{ fontSize: 9 }} />
                          )}
                          {outcome === 'pending' && (
                            <Chip label="⏳ Pending" size="small" color="default" sx={{ fontSize: 9 }} />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <MuiButton
                            size="small"
                            onClick={() => setViewingVote(vote)}
                            title="View Details"
                          >
                            👁️
                          </MuiButton>
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {votesPage * votesPerPage + 1} -{' '}
            {Math.min((votesPage + 1) * votesPerPage, filteredVotes.length)} of{' '}
            {filteredVotes.length} votes
          </div>
          <div className="flex gap-2">
            <MuiButton
              size="small"
              disabled={votesPage === 0}
              onClick={() => setVotesPage(votesPage - 1)}
            >
              Previous
            </MuiButton>
            <MuiButton
              size="small"
              disabled={(votesPage + 1) * votesPerPage >= filteredVotes.length}
              onClick={() => setVotesPage(votesPage + 1)}
            >
              Next
            </MuiButton>
          </div>
        </div>
      </Card>
    </>
  )}
</div>

{/* Vote Details Modal */}
<Dialog open={!!viewingVote} onClose={() => setViewingVote(null)} maxWidth="md" fullWidth>
  <DialogTitle>Vote Details</DialogTitle>
  <DialogContent>
    {viewingVote && (
      <div className="space-y-4 mt-2">
        {/* Voter Info */}
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
          <h4 className="font-semibold text-sm mb-3">Voter Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Wallet:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs">{viewingVote.voter_wallet}</span>
                <button onClick={() => copyToClipboard(viewingVote.voter_wallet)}>
                  <ContentCopyIcon sx={{ fontSize: 12 }} />
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Token % at vote:</span>
              <span className="font-medium">
                {(viewingVote.token_percentage_snapshot || 0).toFixed(3)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vote timestamp:</span>
              <span className="font-medium">
                {new Date(viewingVote.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Asset Info */}
        {viewingVote.pending_asset && (
          <Card className="p-4 bg-gray-50">
            <h4 className="font-semibold text-sm mb-3">Asset Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <Chip label={viewingVote.pending_asset.asset_type} size="small" />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Summary:</span>
                <span className="font-medium">
                  {extractAssetSummary(viewingVote.pending_asset.asset_data)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Chip
                  label={viewingVote.pending_asset.verification_status}
                  size="small"
                  color={getStatusColor(viewingVote.pending_asset.verification_status) as any}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Submitted by:</span>
                <span className="font-mono text-xs">
                  {shortenAddress(viewingVote.pending_asset.submitter_wallet)}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Karma Breakdown */}
        <Card className="p-4 bg-green-50">
          <h4 className="font-semibold text-sm mb-3">Karma Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Vote type:</span>
              <Chip
                label={viewingVote.vote_type === 'upvote' ? '⬆️ Upvote' : '⬇️ Report'}
                size="small"
                color={viewingVote.vote_type === 'upvote' ? 'success' : 'error'}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Karma earned:</span>
              <span
                className={`font-bold text-lg ${
                  (viewingVote.karma_earned || 0) > 0
                    ? 'text-green-600'
                    : (viewingVote.karma_earned || 0) < 0
                    ? 'text-red-600'
                    : 'text-gray-400'
                }`}
              >
                {viewingVote.karma_earned || 0 > 0 ? '+' : ''}
                {viewingVote.karma_earned || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outcome:</span>
              {(() => {
                const outcome = getVoteOutcome(viewingVote)
                return (
                  <>
                    {outcome === 'earned' && (
                      <Chip label="✅ Earned Karma" size="small" color="success" />
                    )}
                    {outcome === 'lost' && (
                      <Chip label="❌ Lost Karma" size="small" color="error" />
                    )}
                    {outcome === 'pending' && (
                      <Chip label="⏳ Pending" size="small" color="default" />
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </Card>

        {/* Full Asset Data */}
        {viewingVote.pending_asset && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Full Asset Data (JSONB)</h4>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(viewingVote.pending_asset.asset_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )}
  </DialogContent>
  <DialogActions>
    <MuiButton onClick={() => setViewingVote(null)}>Close</MuiButton>
  </DialogActions>
</Dialog>

{/* Suspicious Activity Modal */}
<Dialog
  open={showSuspiciousModal}
  onClose={() => setShowSuspiciousModal(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle className="text-yellow-600">⚠️ Suspicious Activity Report</DialogTitle>
  <DialogContent>
    <div className="space-y-3 mt-2">
      {suspiciousActivity.map((activity, idx) => (
        <Card key={idx} className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Chip
                  label={activity.pattern.replace(/_/g, ' ').toUpperCase()}
                  size="small"
                  color="warning"
                />
                <Chip
                  label={activity.severity.toUpperCase()}
                  size="small"
                  color={activity.severity === 'high' ? 'error' : 'warning'}
                />
              </div>
              <p className="text-sm font-mono mb-1">{activity.wallet}</p>
              <p className="text-sm text-gray-600">{activity.details}</p>
              <p className="text-xs text-purple-600 mt-2">
                Recommended: {activity.recommendedAction}
              </p>
            </div>
            <div className="flex gap-1">
              <MuiButton
                size="small"
                variant="outlined"
                onClick={() => {
                  setViewingKarmaWallet(
                    karmaRecords.find((k) => k.wallet_address === activity.wallet) || null
                  )
                  setShowSuspiciousModal(false)
                }}
              >
                View
              </MuiButton>
              <MuiButton
                size="small"
                color="error"
                onClick={() => {
                  const wallet = karmaRecords.find((k) => k.wallet_address === activity.wallet)
                  if (wallet) {
                    setBanningWallet(wallet)
                    setShowSuspiciousModal(false)
                  }
                }}
              >
                Ban
              </MuiButton>
            </div>
          </div>
        </Card>
      ))}

      {suspiciousActivity.length === 0 && (
        <p className="text-center text-gray-500 py-8">No suspicious activity detected</p>
      )}
    </div>
  </DialogContent>
  <DialogActions>
    <MuiButton onClick={() => setShowSuspiciousModal(false)}>Close</MuiButton>
  </DialogActions>
</Dialog>

