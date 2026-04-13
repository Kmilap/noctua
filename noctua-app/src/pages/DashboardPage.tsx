import { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';

interface DashboardData {
  active_services: number;
  open_incidents: number;
  avg_response_time: number;
  alerts_today: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:8000/api/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando dashboard...</p>;
  if (!data)   return <p className="p-8 text-red-500">Error al cargar los datos.</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Servicios activos"
          value={data.active_services}
          icon="🟢"
          color="green"
        />
        <MetricCard
          title="Incidentes abiertos"
          value={data.open_incidents}
          icon="🔴"
          color="red"
        />
        <MetricCard
          title="Tiempo de respuesta promedio"
          value={data.avg_response_time}
          unit="ms"
          icon="⚡"
          color="blue"
        />
        <MetricCard
          title="Alertas hoy"
          value={data.alerts_today}
          icon="🔔"
          color="yellow"
        />
      </div>
    </div>
  );
}