package expo

import org.gradle.api.Plugin
import org.gradle.api.Project

class ExpoModuleGradlePlugin implements Plugin<Project> {
    void apply(Project project) {
        // Provide safeExtGet as project extension method (for compatibility)
        project.ext.safeExtGet = { String prop, def fallback ->
            return project.rootProject.ext.has(prop) ? project.rootProject.ext.get(prop) : fallback
        }
        
        // Create expoModule extension
        project.extensions.create('expoModule', ExpoModuleExtension, project)
        
        // Configure Android SDK versions if android plugin is applied
        project.plugins.withId('com.android.library') {
            project.android {
                compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)
                
                defaultConfig {
                    minSdkVersion project.ext.safeExtGet("minSdkVersion", 23)
                    targetSdkVersion project.ext.safeExtGet("targetSdkVersion", 34)
                }
                
                lintOptions {
                    abortOnError false
                }
            }
        }
        
        project.plugins.withId('com.android.application') {
            project.android {
                compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)
                
                defaultConfig {
                    minSdkVersion project.ext.safeExtGet("minSdkVersion", 23)
                    targetSdkVersion project.ext.safeExtGet("targetSdkVersion", 34)
                }
                
                lintOptions {
                    abortOnError false
                }
            }
        }
    }
}

class ExpoModuleExtension {
    private Project project

    ExpoModuleExtension(Project project) {
        this.project = project
    }

    def safeExtGet(String prop, def fallback) {
        return project.rootProject.ext.has(prop) ? project.rootProject.ext.get(prop) : fallback
    }
}
