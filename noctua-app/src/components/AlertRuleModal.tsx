import Modal from './Modal'
import AlertRuleForm from './AlertRuleForm'
import type { AlertRule } from './AlertRuleCard'

type AlertRuleModalProps = {
  isOpen: boolean
  onClose: () => void
  // Si viene, estamos editando. Si no, creando.
  rule?: AlertRule
  // Callback cuando se crea/actualiza exitosamente.
  // El padre decide qué hacer (agregar a la lista, refrescar, etc.)
  onSuccess: (rule: AlertRule) => void
}

export default function AlertRuleModal({
  isOpen,
  onClose,
  rule,
  onSuccess,
}: AlertRuleModalProps) {
  const isEditMode = !!rule

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar regla de alerta' : 'Nueva regla de alerta'}
      subtitle={isEditMode ? 'Modificá los valores de esta regla.' : '5 campos. 30 segundos. Sin complicaciones.'}
      closeOnBackdropClick={false}  // Para no perder datos del form sin querer
    >
      {/* key={rule?.id ?? 'new'} obliga a remountear el form
          cuando cambiás entre crear/editar diferentes reglas,
          asegurando que el estado interno del form se resetee */}
      <AlertRuleForm
        key={rule?.id ?? 'new'}
        initialData={rule}
        onSuccess={(savedRule) => {
          onSuccess(savedRule)
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}