pipeline {
    agent any

    parameters {
        string(
            name: 'IMAGE_NAME',
            defaultValue: 'ghcr.io/be/bezl/chatbe:latest',
            description: 'Docker image to deploy (e.g. ghcr.io/be/bezl/chatbe:sha-abc1234)'
        )
    }

    environment {
        GHCR_USER = credentials('ghcr-user')
        GHCR_TOKEN = credentials('ghcr-token')
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/be/bezl-chatbe.git',
                    credentialsId: 'github-deploy-token'
            }
        }

        stage('Run Ansible Deploy') {
            steps {
                sh '''
                ansible-playbook \
                    -i ansible/inventory/production/hosts \
                    ansible/deploy.yml \
                    --extra-vars "image_name=${IMAGE_NAME} ghcr_user=${GHCR_USER} ghcr_token=${GHCR_TOKEN}"
                '''
            }
        }
    }

    post {
        failure {
            echo "Deploy failed! Check the logs above."
        }
        success {
            echo "Deploy completed successfully."
        }
    }
}
