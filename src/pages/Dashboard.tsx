import React from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Match, Player } from '../types';
import { format } from 'date-fns';
import { Calendar, Star, Crown, Trophy, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [matches, setMatches] = React.useState<(Match & { players: Player[] })[]>([]);
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch matches ordered by timestamp
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(matchesRef, orderBy('timestamp', 'asc'));
        const matchesSnapshot = await getDocs(matchesQuery);
        
        const matchesData = await Promise.all(
          matchesSnapshot.docs.map(async (doc) => {
            const matchData = { 
              id: doc.id, 
              ...doc.data(),
              timestamp: doc.data().timestamp instanceof Timestamp 
                ? doc.data().timestamp.toDate() 
                : new Date(doc.data().timestamp)
            } as Match;
            
            // Fetch players for each match
            const playersRef = collection(db, 'players');
            const playersSnapshot = await getDocs(playersRef);
            const players = playersSnapshot.docs.map(playerDoc => ({
              id: playerDoc.id,
              ...playerDoc.data()
            })) as Player[];

            return {
              ...matchData,
              players
            };
          })
        );

        // Filter out past matches
        const currentMatches = matchesData.filter(match => 
          new Date(match.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Show matches from last 24 hours
        );
        
        setMatches(currentMatches);

        // Fetch predictions if user is logged in
        if (user) {
          const predictionsRef = collection(db, 'predictions');
          const predictionsQuery = query(
            predictionsRef,
            where('userId', '==', user.uid)
          );
          const predictionsSnapshot = await getDocs(predictionsQuery);
          const predictionsData = predictionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setPredictions(predictionsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const isMatchStarted = (matchTimestamp: Date) => {
    return new Date() >= matchTimestamp;
  };

  const getTimeStatus = (timestamp: Date) => {
    const now = new Date();
    const diff = timestamp.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 0) return 'Started';
    if (hours === 0) return 'Starting soon';
    if (hours < 24) return `Starts in ${hours} hours`;
    return `Starts in ${Math.floor(hours / 24)} days`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* User Stats */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{user?.displayName}</h2>
                <p className="text-purple-200">Cricket Enthusiast</p>
              </div>
            </div>
            <div className="flex space-x-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">{predictions.length}</div>
                <div className="text-purple-200">Predictions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-6">
          {matches.length > 0 ? (
            matches.map((match) => {
              const prediction = predictions.find(p => p.matchId === match.id);
              const matchStarted = isMatchStarted(match.timestamp);
              const timeStatus = getTimeStatus(match.timestamp);
              
              return (
                <div key={match.id} 
                  className="bg-white/10 backdrop-blur-lg rounded-2xl border border-purple-500/20 overflow-hidden"
                >
                  {/* Match Header with Description */}
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 border-b border-purple-500/20">
                    <h3 className="text-lg font-medium text-purple-200">{match.description}</h3>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-3">
                          <Trophy className="h-8 w-8 text-yellow-400" />
                          <h2 className="text-2xl font-bold text-white">{match.team1} vs {match.team2}</h2>
                        </div>
                        <div className="flex items-center mt-2 text-purple-200">
                          <Calendar className="h-5 w-5 mr-2" />
                          <span>{format(match.timestamp, 'PPP p')}</span>
                          <span className="mx-2">•</span>
                          <span>{match.venue}</span>
                        </div>
                        <div className="flex items-center mt-2 text-purple-200">
                          <Clock className="h-5 w-5 mr-2" />
                          <span>{timeStatus}</span>
                        </div>
                      </div>
                      {matchStarted ? (
                        <div className="flex items-center text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-lg">
                          <AlertCircle className="h-5 w-5 mr-2" />
                          <span>Match Started</span>
                        </div>
                      ) : (
                        <Link
                          to={`/predict/${match.id}`}
                          className="inline-flex items-center px-6 py-3 text-base font-semibold rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300"
                        >
                          {prediction ? 'Update Prediction' : 'Make Prediction'}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;