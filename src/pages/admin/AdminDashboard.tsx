import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Image as ImageIcon,
  Users,
  Clock3,
  BadgeCheck,
  LogOut,
} from 'lucide-react';

interface SubscriptionRequest {
  id: number;
  name: string;
  email: string;
  plan: string;
  paymentImage: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const AdminDashboard = () => {
  // EMPTY ARRAY
  // requests will come later from database / backend
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);

  const isAdmin = localStorage.getItem('isAdmin');

  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  const approveRequest = (id: number) => {
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: 'approved' } : req
      )
    );
  };

  const rejectRequest = (id: number) => {
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: 'rejected' } : req
      )
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    window.location.href = '/';
  };

  const totalRequests = requests.length;

  const approvedRequests = requests.filter(
    (req) => req.status === 'approved'
  ).length;

  const pendingRequests = requests.filter(
    (req) => req.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* HEADER */}
      <div className="border-b border-gray-800 bg-gray-900/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-500" />

            <div>
              <h1 className="text-3xl font-bold">
                Admin Dashboard
              </h1>

              <p className="text-gray-400 text-sm mt-1">
                Subscription & payment activation control panel
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 transition px-5 py-2 rounded-xl font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* TOTAL */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-10 h-10 text-blue-500" />

              <span className="text-sm text-gray-400">
                Total Requests
              </span>
            </div>

            <h2 className="text-4xl font-bold">
              {totalRequests}
            </h2>
          </div>

          {/* PENDING */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Clock3 className="w-10 h-10 text-yellow-500" />

              <span className="text-sm text-gray-400">
                Pending
              </span>
            </div>

            <h2 className="text-4xl font-bold text-yellow-400">
              {pendingRequests}
            </h2>
          </div>

          {/* APPROVED */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <BadgeCheck className="w-10 h-10 text-green-500" />

              <span className="text-sm text-gray-400">
                Approved
              </span>
            </div>

            <h2 className="text-4xl font-bold text-green-400">
              {approvedRequests}
            </h2>
          </div>
        </div>

        {/* REQUESTS TABLE */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-800">
            <h2 className="text-2xl font-bold">
              Payment Activation Requests
            </h2>

            <p className="text-gray-400 text-sm mt-1">
              Review uploaded payment screenshots and activate subscriptions
            </p>
          </div>

          {/* EMPTY STATE */}
          {requests.length === 0 && (
            <div className="p-20 text-center">
              <Shield className="w-20 h-20 text-gray-700 mx-auto mb-5" />

              <h3 className="text-3xl font-bold mb-3">
                No Requests Yet
              </h3>

              <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
                When users subscribe and upload payment screenshots,
                their requests will automatically appear here for review.
              </p>
            </div>
          )}

          {/* REQUESTS */}
          {requests.length > 0 && (
            <div className="divide-y divide-gray-800">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 hover:bg-gray-800/30 transition"
                >
                  {/* USER INFO */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center font-bold text-lg">
                        {request.name.charAt(0)}
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold">
                          {request.name}
                        </h3>

                        <p className="text-gray-400 text-sm">
                          {request.email}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm">
                        Plan: {request.plan}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          request.status === 'approved'
                            ? 'bg-green-500/20 text-green-300'
                            : request.status === 'rejected'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {request.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* PAYMENT IMAGE */}
                  <div className="w-full lg:w-72">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden">
                      <img
                        src={request.paymentImage}
                        alt="Payment Proof"
                        className="w-full h-44 object-cover"
                      />

                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300">
                          <ImageIcon className="w-4 h-4" />

                          <span className="text-sm">
                            Payment Screenshot
                          </span>
                        </div>

                        <a
                          href={request.paymentImage}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-col gap-3 w-full lg:w-44">
                    <button
                      onClick={() => approveRequest(request.id)}
                      disabled={request.status === 'approved'}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition ${
                        request.status === 'approved'
                          ? 'bg-green-900/40 text-green-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve
                    </button>

                    <button
                      onClick={() => rejectRequest(request.id)}
                      disabled={request.status === 'rejected'}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition ${
                        request.status === 'rejected'
                          ? 'bg-red-900/40 text-red-400 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};