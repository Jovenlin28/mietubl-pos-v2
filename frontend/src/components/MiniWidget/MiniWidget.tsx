import React from 'react'
import styles from './MiniWidget.module.scss'

interface MiniWidgetProps {
  title: string
  value: string
  changeText: string
  changeColor: string
  linkText: string
}

const MiniWidget: React.FC<MiniWidgetProps> = ({ title, value, changeText, changeColor, linkText }) => {
  return (
    <div className={styles.miniWidget}>
      <div className={styles.miniHeader}>{title}</div>
      <div className={styles.miniValue}>{value}</div>
      <div className={`${styles.miniChange} ${styles[changeColor]}`}>{changeText}</div>
      <a href="#" className={styles.miniLink}>{linkText}</a>
    </div>
  )
}

export default MiniWidget
