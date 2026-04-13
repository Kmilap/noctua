interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon: string;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

export default function MetricCard({ title, value, unit = '', icon, color = 'blue' }: MetricCardProps) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className={`p-3 rounded-xl text-2xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">
          {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
        </p>
      </div>
    </div>
  );
}