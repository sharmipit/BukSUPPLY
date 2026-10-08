import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Temporary dashboard page so you can test sign-in and sign-out.
export default function Placeholder({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif', padding: 32 }}>
      <h1>{title}</h1>
      <p>
        Signed in as <strong>{user.firstName} {user.lastName}</strong> ({user.role})
      </p>
      <button
        onClick={() => { logout(); navigate('/', { replace: true }); }}
        style={{ padding: '10px 20px', cursor: 'pointer' }}
      >
        Log out
      </button>
    </div>
  );
}
