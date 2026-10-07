import React from 'react'
import styles from './MainWidget.module.scss'

interface MainWidgetProps {
  title: string
  value: string
  change: string
  color: string
}

const MainWidget: React.FC<MainWidgetProps> = ({ title, value, change, color }) => {
  return (
    <div className={`${styles.mainWidget} ${styles[color]}`}>
      <div className={styles.widgetHeader}>{title}</div>
      <div className={styles.widgetValue}>{value}</div>
      <div className={styles.widgetChange}>{change}</div>
    </div>
  )
}

export default MainWidget
